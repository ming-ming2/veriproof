package com.example.veriproof.domain.exam.service;

import com.example.veriproof.domain.auth.entity.Professor;
import com.example.veriproof.domain.auth.repository.ProfessorRepository;
import com.example.veriproof.domain.exam.dto.Request;
import com.example.veriproof.domain.exam.dto.Response;
import com.example.veriproof.domain.exam.entity.*;
import com.example.veriproof.domain.exam.repository.ExamRepository;
import com.example.veriproof.domain.exam.repository.ExamSessionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.security.SecureRandom;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ExamService {

    private final ExamRepository examRepository;
    private final ProfessorRepository professorRepository;
    private final ExamSessionRepository examSessionRepository;
    // 난수 생성을 위해 암호학적으로 안전한 SecureRandom 사용
    private static final SecureRandom SECURE_RANDOM = new SecureRandom();
    private static final String ALPHANUMERIC = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

    @Transactional
    public Response.ExamCreateResponse createExam(Long professorId, Request request) {
        // 1. 교수 엔티티 조회
        Professor professor = professorRepository.findById(professorId)
                .orElseThrow(() -> new IllegalArgumentException("Professor not found"));

        // 2. 시간 유효성 검증 (ends_at > starts_at)[cite: 1]
        if (!request.endsAt().isAfter(request.startsAt())) {
            throw new IllegalArgumentException("종료 시간은 시작 시간보다 이후여야 합니다.");
        }

        // 3. 고유한 6자리 시험 코드 생성
        String examCode = generateUniqueExamCode();

        // 4. Exam 엔티티 생성
        Exam exam = Exam.builder()
                .professor(professor)
                .title(request.title())
                .examCode(examCode)
                .startsAt(request.startsAt())
                .endsAt(request.endsAt())
                .build();

        // 5. 문항(Question) 및 선택지(Choice) 추가 (Entity의 편의 메서드 활용)
        for (Request.QuestionDto qDto : request.questions()) {
            Question question = Question.builder()
                    .questionType(QuestionType.valueOf(qDto.questionType()))
                    .body(qDto.body())
                    .correctAnswer(qDto.correctAnswer())
                    .points(qDto.points())
                    .displayOrder(qDto.displayOrder())
                    .build();

            if ("MULTIPLE_CHOICE".equals(qDto.questionType()) && qDto.choices() != null) {
                for (Request.ChoiceDto cDto : qDto.choices()) {
                    QuestionChoice choice = QuestionChoice.builder()
                            .body(cDto.body())
                            .isCorrect(cDto.isCorrect())
                            .displayOrder(cDto.displayOrder())
                            .build();
                    question.addChoice(choice); // Question 내부에 구현된 연관관계 편의 메서드
                }
            }
            exam.addQuestion(question); // Exam 내부에 구현된 연관관계 편의 메서드
        }

        // 6. 사전 응시 명단(Roster) 추가
        if (request.roster() != null) {
            for (Request.RosterDto rDto : request.roster()) {
                ExamRoster roster = ExamRoster.builder()
                        .studentNumber(rDto.studentNumber())
                        .studentName(rDto.studentName())
                        .build();
                exam.addRoster(roster);
            }
        }

        // 7. DB 저장 (Cascade 설정에 의해 하위 연관 엔티티도 함께 저장됨)
        Exam savedExam = examRepository.save(exam);

        // 8. API 명세서에 맞춘 응답 반환[cite: 2]
        String qrCodeUrl = "/api/v1/exams/" + savedExam.getId() + "/qr";
        String proctorLink = "https://veriproof.com/proctor/" + savedExam.getProctorToken();

        return new Response.ExamCreateResponse(
                savedExam.getId(),
                savedExam.getExamCode(),
                proctorLink,
                qrCodeUrl,
                request.questions().size()
        );
    }


    private String generateUniqueExamCode() {
        String code;
        do {
            StringBuilder sb = new StringBuilder(6);
            for (int i = 0; i < 6; i++) {
                sb.append(ALPHANUMERIC.charAt(SECURE_RANDOM.nextInt(ALPHANUMERIC.length())));
            }
            code = sb.toString();
        } while (examRepository.existsByExamCode(code)); // DB 충돌 검사
        return code;
    }

    @Transactional(readOnly = true)
    public List<Response.ExamListResponse> getExamsByProfessor(Long professorId) {
        return examRepository.findAllByProfessorIdOrderByCreatedAtDesc(professorId).stream()
                .map(exam -> new Response.ExamListResponse(
                        exam.getId(),
                        exam.getTitle(),
                        exam.getExamCode(),
                        exam.getStartsAt(),
                        exam.getEndsAt(),
                        exam.getQuestions().size(), // @OneToMany 관계 활용
                        exam.getRosters().size()    // @OneToMany 관계 활용
                ))
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public Response.ExamDetailResponse getExamDetail(Long professorId, Long examId) {
        // 1. 시험 조회 (예외 발생 시 API 명세에 따라 404 EXAM_NOT_FOUND에 매핑될 수 있도록 처리)
        Exam exam = examRepository.findById(examId)
                .orElseThrow(() -> new IllegalArgumentException("EXAM_NOT_FOUND"));

        // 2. 권한 검증: 본인이 만든 시험인지 확인 (403 FORBIDDEN)
        if (!exam.getProfessor().getId().equals(professorId)) {
            throw new SecurityException("FORBIDDEN");
        }

        // 3. 반환할 URL 조립
        String proctorLink = "https://veriproof.com/proctor/" + exam.getProctorToken();
        String qrCodeUrl = "/api/v1/exams/" + exam.getId() + "/qr";

        // 4. 문항(Questions) DTO 변환
        List<Response.QuestionDetailDto> questionDtos = exam.getQuestions().stream()
                .map(q -> new Response.QuestionDetailDto(
                        q.getId(),
                        q.getQuestionType().name(),
                        q.getBody(),
                        q.getPoints(),
                        q.getCorrectAnswer(),
                        q.getDisplayOrder(),
                        q.getImages().stream()
                                .map(img -> new Response.ImageDetailDto(img.getId(), "/api/v1/files/images/" + img.getFilePath()))
                                .collect(Collectors.toList()),
                        q.getChoices().stream()
                                .map(c -> new Response.ChoiceDetailDto(c.getId(), c.getBody(), c.getIsCorrect(), c.getDisplayOrder()))
                                .collect(Collectors.toList())
                ))
                .collect(Collectors.toList());

        // 5. 응시자 세션(Sessions) DTO 변환
        List<Response.SessionDetailDto> sessionDtos = examSessionRepository.findAllByExamId(examId).stream()
                .map(s -> new Response.SessionDetailDto(
                        s.getSessionUuid().toString(),
                        s.getStudentNumber(),
                        s.getStudentName(),
                        s.getStatus(),
                        s.getTotalScore(),
                        s.getStartedAt(),
                        s.getSubmittedAt()
                ))
                .collect(Collectors.toList());

        // 6. 최종 응답 객체 생성
        return new Response.ExamDetailResponse(
                exam.getId(), exam.getTitle(), exam.getExamCode(), exam.getStartsAt(), exam.getEndsAt(),
                proctorLink, qrCodeUrl, questionDtos, sessionDtos
        );
    }
}