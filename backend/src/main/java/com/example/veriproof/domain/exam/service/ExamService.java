package com.example.veriproof.domain.exam.service;

import com.example.veriproof.domain.auth.entity.Professor;
import com.example.veriproof.domain.auth.repository.ProfessorRepository;
import com.example.veriproof.domain.exam.dto.Request;
import com.example.veriproof.domain.exam.dto.Response;
import com.example.veriproof.domain.exam.entity.*;
import com.example.veriproof.domain.exam.repository.ExamRepository;
import com.example.veriproof.domain.exam.repository.ExamSessionRepository;
import com.example.veriproof.domain.exam.repository.SubmissionAnswerRepository;
import com.example.veriproof.global.exception.CustomException;
import com.example.veriproof.global.exception.ErrorCode;
import com.example.veriproof.infra.storage.FileStorageService;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.security.SecureRandom;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ExamService {

    private final ExamRepository examRepository;
    private final ProfessorRepository professorRepository;
    private final ExamSessionRepository examSessionRepository;
    private final SubmissionAnswerRepository submissionAnswerRepository;
    private final FileStorageService fileStorageService;

    @Value("${app.frontend-base-url}")
    private String frontendBaseUrl;

    // 난수 생성을 위해 암호학적으로 안전한 SecureRandom 사용
    private static final SecureRandom SECURE_RANDOM = new SecureRandom();
    private static final String ALPHANUMERIC = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

    @Transactional
    public Response.ExamCreateResponse createExam(Long professorId, Request request) {
        // 1. 교수 엔티티 조회
        Professor professor = professorRepository.findById(professorId)
                .orElseThrow(() -> new CustomException(ErrorCode.INVALID_CREDENTIALS));

        // 2~4. 공통 유효성 검증
        validateExamRequest(request);
        // 백로그 25: 좌석 설정 유효성 검증 (행/열 페어, 좌석 수 >= 명단 수)
        validateSeatConfig(request.seatRows(), request.seatCols(), request.roster().size());

        // 5. 고유한 6자리 시험 코드 생성
        String examCode = generateUniqueExamCode();

        // 6. Exam 엔티티 생성
        Exam exam = Exam.builder()
                .professor(professor)
                .title(request.title())
                .examCode(examCode)
                .startsAt(request.startsAt())
                .endsAt(request.endsAt())
                .seatRows(request.seatRows())
                .seatCols(request.seatCols())
                .build();

        // 7. 문항(Question) 및 선택지(Choice) 추가 (Entity의 편의 메서드 활용)
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
                    question.addChoice(choice);
                }
            }
            exam.addQuestion(question);
        }

        // 8. 사전 응시 명단(Roster) 추가
        for (Request.RosterDto rDto : request.roster()) {
            ExamRoster roster = ExamRoster.builder()
                    .studentNumber(rDto.studentNumber())
                    .studentName(rDto.studentName())
                    .build();
            exam.addRoster(roster);
        }

        // 8-1. 백로그 25: 좌석 배치 사용 시 이름순으로 좌석 번호 자동 배정
        assignSeatNumbers(exam);

        // 9. DB 저장 (Cascade 설정에 의해 하위 연관 엔티티도 함께 저장됨)
        Exam savedExam = examRepository.save(exam);

        // 10. 응답 반환 (QR 제거됨 - 시험 코드만 사용)
        String proctorLink = frontendBaseUrl + "/proctor/" + savedExam.getProctorToken();

        return new Response.ExamCreateResponse(
                savedExam.getId(),
                savedExam.getExamCode(),
                proctorLink,
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
                        exam.getQuestions().size(),
                        exam.getRosters().size(),
                        examSessionRepository.countByExamId(exam.getId()),
                        examSessionRepository.countByExamIdAndStatusAndGradingStatus(
                                exam.getId(), ExamSession.STATUS_SUBMITTED, ExamSession.GRADING_UNGRADED)
                ))
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public Response.ExamDetailResponse getExamDetail(Long professorId, Long examId) {
        // 1. 시험 조회
        Exam exam = examRepository.findById(examId)
                .orElseThrow(() -> new CustomException(ErrorCode.EXAM_NOT_FOUND));

        // 2. 권한 검증: 본인이 만든 시험인지 확인
        if (!exam.getProfessor().getId().equals(professorId)) {
            throw new CustomException(ErrorCode.FORBIDDEN);
        }

        // 3. 반환할 URL 조립 (QR 제거됨)
        String proctorLink = frontendBaseUrl + "/proctor/" + exam.getProctorToken();

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

        // 5. 응시 명단(Roster) DTO 변환 (백로그 1-5 요구사항)
        List<Response.RosterDetailDto> rosterDtos = exam.getRosters().stream()
                .map(r -> new Response.RosterDetailDto(
                        r.getId(),
                        r.getStudentNumber(),
                        r.getStudentName(),
                        r.getSeatNumber()
                ))
                .collect(Collectors.toList());

        // 6. 응시자 세션(Sessions) DTO 변환
        List<Response.SessionDetailDto> sessionDtos = examSessionRepository.findAllByExamId(examId).stream()
                .map(s -> new Response.SessionDetailDto(
                        s.getId(),
                        s.getSessionUuid().toString(),
                        s.getStudentNumber(),
                        s.getStudentName(),
                        s.getStatus(),
                        s.getGradingStatus(),
                        s.getTotalScore(),
                        s.getStartedAt(),
                        s.getSubmittedAt()
                ))
                .collect(Collectors.toList());

        // 7. 최종 응답 객체 생성
        return new Response.ExamDetailResponse(
                exam.getId(), exam.getTitle(), exam.getExamCode(), exam.getStartsAt(), exam.getEndsAt(),
                proctorLink, exam.getSeatRows(), exam.getSeatCols(), questionDtos, rosterDtos, sessionDtos
        );
    }

    @Transactional
    public Response.ExamDetailResponse updateExam(Long professorId, Long examId, Request request) {
        Exam exam = examRepository.findById(examId)
                .orElseThrow(() -> new CustomException(ErrorCode.EXAM_NOT_FOUND));

        if (!exam.getProfessor().getId().equals(professorId)) {
            throw new CustomException(ErrorCode.FORBIDDEN);
        }

        // 응시 세션이 1건이라도 존재하면 수정 불가 (응시 데이터 무결성 보호)
        if (examSessionRepository.countByExamId(examId) > 0) {
            throw new CustomException(ErrorCode.EXAM_HAS_SESSIONS);
        }

        validateExamRequest(request);
        validateSeatConfig(request.seatRows(), request.seatCols(), request.roster().size());

        // 기존 문항에 첨부된 이미지 파일 경로 수집 (orphanRemoval로 DB 레코드는 삭제되지만,
        // 디스크의 물리 파일은 별도로 정리해야 함)
        List<String> obsoleteImagePaths = new ArrayList<>();
        for (Question q : exam.getQuestions()) {
            for (QuestionImage img : q.getImages()) {
                obsoleteImagePaths.add(img.getFilePath());
            }
        }

        // 기본 정보 갱신 (좌석 설정 포함)
        exam.update(request.title(), request.startsAt(), request.endsAt(),
                request.seatRows(), request.seatCols());

        // 문항/명단 전체 교체 (orphanRemoval=true)
        // clear 직후 flush로 DELETE를 먼저 강제 실행 — 이걸 안 하면
        // 같은 트랜잭션 안에서 INSERT가 먼저 시도되어 UNIQUE(exam_id, display_order)
        // 및 UNIQUE(exam_id, student_number) 제약이 충돌함.
        exam.getQuestions().clear();
        exam.getRosters().clear();
        examRepository.flush();

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
                    question.addChoice(choice);
                }
            }
            exam.addQuestion(question);
        }

        for (Request.RosterDto rDto : request.roster()) {
            ExamRoster roster = ExamRoster.builder()
                    .studentNumber(rDto.studentNumber())
                    .studentName(rDto.studentName())
                    .build();
            exam.addRoster(roster);
        }

        // 백로그 25: 좌석 번호 재배정 (명단/좌석 설정 변경 반영)
        assignSeatNumbers(exam);

        // flush 후 더 이상 참조되지 않는 이미지 파일을 디스크에서 제거
        examRepository.flush();
        for (String path : obsoleteImagePaths) {
            fileStorageService.deleteFile(path);
        }

        return getExamDetail(professorId, examId);
    }

    @Transactional
    public void deleteExam(Long professorId, Long examId) {
        Exam exam = examRepository.findById(examId)
                .orElseThrow(() -> new CustomException(ErrorCode.EXAM_NOT_FOUND));

        if (!exam.getProfessor().getId().equals(professorId)) {
            throw new CustomException(ErrorCode.FORBIDDEN);
        }

        // ExamSession은 Exam에 cascade되지 않으므로 응시자 존재 시 FK로 인해 삭제 실패함
        // → 명시적으로 차단하여 의도치 않은 응시 기록 손실을 방지
        if (examSessionRepository.countByExamId(examId) > 0) {
            throw new CustomException(ErrorCode.EXAM_HAS_SESSIONS);
        }

        // 디스크에 남는 물리 이미지 파일 경로를 먼저 수집
        List<String> imagePaths = new ArrayList<>();
        for (Question q : exam.getQuestions()) {
            for (QuestionImage img : q.getImages()) {
                imagePaths.add(img.getFilePath());
            }
        }

        examRepository.delete(exam);
        examRepository.flush();

        for (String path : imagePaths) {
            fileStorageService.deleteFile(path);
        }
    }

    /**
     * 교수가 특정 학생의 답안을 모두 조회한다. (백로그 11 채점 UI에서 사용)
     */
    @Transactional(readOnly = true)
    public Response.SessionAnswersResponse getSessionAnswers(Long professorId, Long examId, Long sessionId) {
        Exam exam = examRepository.findById(examId)
                .orElseThrow(() -> new CustomException(ErrorCode.EXAM_NOT_FOUND));

        if (!exam.getProfessor().getId().equals(professorId)) {
            throw new CustomException(ErrorCode.FORBIDDEN);
        }

        ExamSession session = examSessionRepository.findById(sessionId)
                .orElseThrow(() -> new CustomException(ErrorCode.SESSION_NOT_FOUND));

        if (!session.getExam().getId().equals(examId)) {
            throw new CustomException(ErrorCode.SESSION_NOT_FOUND);
        }

        List<SubmissionAnswer> rows = submissionAnswerRepository.findAllByExamSessionId(sessionId);

        List<Response.AnswerDetailDto> answers = rows.stream()
                .sorted((a, b) -> Integer.compare(
                        a.getQuestion().getDisplayOrder(),
                        b.getQuestion().getDisplayOrder()))
                .map(a -> {
                    Question q = a.getQuestion();
                    List<Long> selectedIds = a.getSelectedChoices().stream()
                            .map(QuestionChoice::getId)
                            .sorted()
                            .collect(Collectors.toList());
                    List<Response.ChoiceDetailDto> choiceDtos = q.getChoices().stream()
                            .sorted((c1, c2) -> Integer.compare(c1.getDisplayOrder(), c2.getDisplayOrder()))
                            .map(c -> new Response.ChoiceDetailDto(c.getId(), c.getBody(), c.getIsCorrect(), c.getDisplayOrder()))
                            .collect(Collectors.toList());
                    return new Response.AnswerDetailDto(
                            q.getId(),
                            q.getQuestionType().name(),
                            q.getBody(),
                            q.getPoints(),
                            q.getCorrectAnswer(),
                            a.getEarnedScore(),
                            a.getAnswerText(),
                            selectedIds,
                            choiceDtos
                    );
                })
                .collect(Collectors.toList());

        return new Response.SessionAnswersResponse(
                session.getId(),
                session.getStudentNumber(),
                session.getStudentName(),
                session.getStatus(),
                session.getTotalScore(),
                session.getSubmittedAt(),
                answers
        );
    }

    /**
     * 백로그 24: 세션 채점 완료 상태 변경. 해당 시험의 교수 본인만 가능.
     */
    @Transactional
    public Response.GradingStatusResponse updateGradingStatus(
            Long professorId, Long examId, Long sessionId, String gradingStatus) {

        // 1. 허용값 검증
        if (!ExamSession.GRADING_UNGRADED.equals(gradingStatus)
                && !ExamSession.GRADING_COMPLETED.equals(gradingStatus)) {
            throw new CustomException(ErrorCode.INVALID_GRADING_STATUS);
        }

        // 2. 시험 조회 + 권한 검증
        Exam exam = examRepository.findById(examId)
                .orElseThrow(() -> new CustomException(ErrorCode.EXAM_NOT_FOUND));
        if (!exam.getProfessor().getId().equals(professorId)) {
            throw new CustomException(ErrorCode.FORBIDDEN);
        }

        // 3. 세션 조회 + 시험 소속 검증
        ExamSession session = examSessionRepository.findById(sessionId)
                .orElseThrow(() -> new CustomException(ErrorCode.SESSION_NOT_FOUND));
        if (!session.getExam().getId().equals(examId)) {
            throw new CustomException(ErrorCode.SESSION_NOT_FOUND);
        }

        // 4. 상태 전이
        session.updateGradingStatus(gradingStatus);

        return new Response.GradingStatusResponse(session.getId(), session.getGradingStatus());
    }

    /**
     * 백로그 25: 좌석 행/열 설정 검증.
     * - 둘 다 null이면 좌석 배치 미사용 (통과)
     * - 둘 중 하나만 있으면 INVALID_SEAT_CONFIG
     * - 좌석 수(행 x 열)가 명단 인원보다 적으면 SEAT_COUNT_INSUFFICIENT
     */
    private void validateSeatConfig(Integer seatRows, Integer seatCols, int rosterCount) {
        boolean rowsPresent = seatRows != null;
        boolean colsPresent = seatCols != null;

        if (rowsPresent != colsPresent) {
            throw new CustomException(ErrorCode.INVALID_SEAT_CONFIG);
        }
        if (!rowsPresent) {
            return; // 좌석 배치 미사용
        }
        if (seatRows < 1 || seatCols < 1) {
            throw new CustomException(ErrorCode.INVALID_SEAT_CONFIG);
        }
        if (seatRows * seatCols < rosterCount) {
            throw new CustomException(ErrorCode.SEAT_COUNT_INSUFFICIENT);
        }
    }

    /**
     * 백로그 25: 좌석 배치 사용 시 명단을 이름순으로 정렬해 1번부터 좌석 번호를 배정한다.
     * 좌석 미사용이면 모든 roster의 seat_number를 null로 초기화한다.
     */
    private void assignSeatNumbers(Exam exam) {
        boolean seatEnabled = exam.getSeatRows() != null && exam.getSeatCols() != null;

        if (!seatEnabled) {
            exam.getRosters().forEach(r -> r.assignSeatNumber(null));
            return;
        }

        List<ExamRoster> sorted = exam.getRosters().stream()
                .sorted(Comparator.comparing(ExamRoster::getStudentName))
                .collect(Collectors.toList());

        int seat = 1;
        for (ExamRoster roster : sorted) {
            roster.assignSeatNumber(seat++);
        }
    }

    private void validateExamRequest(Request request) {
        if (!request.endsAt().isAfter(request.startsAt())) {
            throw new CustomException(ErrorCode.EXAM_TIME_INVALID);
        }

        if (request.roster() == null || request.roster().isEmpty()) {
            throw new CustomException(ErrorCode.ROSTER_EMPTY);
        }

        for (Request.QuestionDto qDto : request.questions()) {
            if ("MULTIPLE_CHOICE".equals(qDto.questionType())) {
                if (qDto.choices() == null || qDto.choices().size() < 2) {
                    throw new CustomException(ErrorCode.MULTIPLE_CHOICE_NO_CHOICES);
                }
                boolean hasCorrect = qDto.choices().stream()
                        .anyMatch(c -> Boolean.TRUE.equals(c.isCorrect()));
                if (!hasCorrect) {
                    throw new CustomException(ErrorCode.MULTIPLE_CHOICE_NO_CORRECT);
                }
            }
        }
    }
}
