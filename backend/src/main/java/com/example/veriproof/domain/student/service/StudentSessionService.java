package com.example.veriproof.domain.student.service;

import com.example.veriproof.domain.exam.entity.Exam;
import com.example.veriproof.domain.exam.entity.ExamRoster;
import com.example.veriproof.domain.exam.entity.ExamSession;
import com.example.veriproof.domain.exam.entity.Question;
import com.example.veriproof.domain.exam.entity.QuestionChoice;
import com.example.veriproof.domain.exam.entity.SubmissionAnswer;
import com.example.veriproof.domain.exam.repository.ExamRepository;
import com.example.veriproof.domain.exam.repository.ExamRosterRepository;
import com.example.veriproof.domain.exam.repository.ExamSessionRepository;
import com.example.veriproof.domain.exam.repository.SubmissionAnswerRepository;
import com.example.veriproof.domain.student.dto.StudentRequest;
import com.example.veriproof.domain.student.dto.StudentResponse;
import com.example.veriproof.global.exception.CustomException;
import com.example.veriproof.global.exception.ErrorCode;
import com.example.veriproof.infra.redis.AnswerDraft;
import com.example.veriproof.infra.redis.AnswerDraftStore;
import com.example.veriproof.infra.redis.SessionLockStore;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.time.OffsetDateTime;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class StudentSessionService {

    private final ExamRepository examRepository;
    private final ExamRosterRepository examRosterRepository;
    private final ExamSessionRepository examSessionRepository;
    private final SubmissionAnswerRepository submissionAnswerRepository;
    private final SessionLockStore sessionLockStore;
    private final AnswerDraftStore answerDraftStore;
    private final AutoGradingService autoGradingService;

    /**
     * 6자리 시험 코드로 시험 메타 조회. (백로그 7)
     * 무인증 엔드포인트이므로 정답 등 민감 정보는 일체 미노출.
     * 시간 검증을 lookup 단계에서 수행해 학생이 학번/이름까지 입력하기 전에 종료/미시작 시험을 차단한다.
     */
    @Transactional(readOnly = true)
    public StudentResponse.ExamLookupResponse lookupExam(String examCode) {
        Exam exam = examRepository.findByExamCode(examCode)
                .orElseThrow(() -> new CustomException(ErrorCode.EXAM_CODE_NOT_FOUND));

        validateExamWindow(exam);

        return new StudentResponse.ExamLookupResponse(
                exam.getId(),
                exam.getTitle(),
                exam.getStartsAt(),
                exam.getEndsAt(),
                exam.getQuestions().size()
        );
    }

    /**
     * 학번/이름 입력 → 응시 시작. (백로그 8 + 20)
     * 검증 순서: 코드 → 시간 → 명단 → 세션 상태 → Redis lock.
     * 이미 점유 중인 lock이 본인 sessionUuid면 통과 (재접속).
     */
    @Transactional
    public StudentResponse.SessionStartResponse startSession(String examCode,
                                                             StudentRequest.SessionStartRequest request) {
        Exam exam = examRepository.findByExamCode(examCode)
                .orElseThrow(() -> new CustomException(ErrorCode.EXAM_CODE_NOT_FOUND));

        validateExamWindow(exam);
        validateRoster(exam.getId(), request);

        ExamSession session = findOrCreateSession(exam, request);

        // Redis lock 획득 — 다른 기기가 점유 중이면 차단
        boolean acquired = sessionLockStore.tryAcquire(
                exam.getId(), session.getStudentNumber(), session.getSessionUuid());
        if (!acquired) {
            throw new CustomException(ErrorCode.CONCURRENT_SESSION);
        }

        return buildSessionStartResponse(exam, session);
    }

    /**
     * 재접속 시 호출. 현재 세션 상태 + 작성 중 답안 초안을 일괄 반환. (백로그 9 보조)
     */
    @Transactional(readOnly = true)
    public StudentResponse.SessionMeResponse getSessionMe(UUID sessionUuid) {
        ExamSession session = examSessionRepository.findBySessionUuid(sessionUuid)
                .orElseThrow(() -> new CustomException(ErrorCode.SESSION_NOT_FOUND));
        if (session.isSubmitted()) {
            throw new CustomException(ErrorCode.SESSION_ALREADY_SUBMITTED);
        }

        Exam exam = session.getExam();
        List<StudentResponse.StudentQuestionDto> questions = exam.getQuestions().stream()
                .sorted(Comparator.comparing(Question::getDisplayOrder))
                .map(this::toStudentQuestionDto)
                .collect(Collectors.toList());

        Map<Long, AnswerDraft> draftMap = answerDraftStore.getAll(sessionUuid);
        List<StudentResponse.AnswerDraftDto> drafts = draftMap.entrySet().stream()
                .map(e -> new StudentResponse.AnswerDraftDto(
                        e.getKey(),
                        e.getValue().answerText(),
                        e.getValue().selectedChoiceIds()))
                .collect(Collectors.toList());

        return new StudentResponse.SessionMeResponse(
                session.getSessionUuid().toString(),
                exam.getId(),
                exam.getTitle(),
                exam.getStartsAt(),
                exam.getEndsAt(),
                session.getStatus(),
                questions,
                drafts
        );
    }

    /**
     * 답안 제출 + 자동 채점. (백로그 10)
     *
     * 흐름:
     *   1) 세션 검증 (IN_PROGRESS만)
     *   2) Redis에서 답안 초안 일괄 read
     *   3) 시험의 모든 문항을 순회하며 SubmissionAnswer + ManyToMany 선택지 row 생성
     *      - MC: 정답 set과 학생 선택 set이 완전 일치 시 만점, 아니면 0점
     *      - SUBJECTIVE: 0점 (교수 채점 대기, 백로그 11)
     *   4) ExamSession.submit(totalScore) — status='SUBMITTED' 전환
     *   5) 트랜잭션 커밋 후 best-effort로 Redis 초안/lock 정리
     */
    @Transactional
    public StudentResponse.SubmitResponse submit(UUID sessionUuid) {
        ExamSession session = examSessionRepository.findBySessionUuid(sessionUuid)
                .orElseThrow(() -> new CustomException(ErrorCode.SESSION_NOT_FOUND));
        if (session.isSubmitted()) {
            throw new CustomException(ErrorCode.SESSION_ALREADY_SUBMITTED);
        }

        Exam exam = session.getExam();
        Map<Long, AnswerDraft> drafts = answerDraftStore.getAll(sessionUuid);

        int totalScore = 0;
        for (Question question : exam.getQuestions()) {
            AnswerDraft draft = drafts.get(question.getId());
            int earned = autoGradingService.gradeQuestion(question, draft);
            totalScore += earned;

            String answerText = (draft != null) ? draft.answerText() : null;

            // 객관식 다중 선택을 ManyToMany 관계로 매핑.
            // draft에 들어온 id 중 실제로 이 문항의 선택지인 것만 추림 (위조/오타 무시).
            Set<QuestionChoice> selectedEntities = new HashSet<>();
            if (draft != null && draft.selectedChoiceIds() != null && !draft.selectedChoiceIds().isEmpty()) {
                Set<Long> selectedIds = draft.selectedChoiceIds();
                for (QuestionChoice choice : question.getChoices()) {
                    if (selectedIds.contains(choice.getId())) {
                        selectedEntities.add(choice);
                    }
                }
            }

            SubmissionAnswer answer = SubmissionAnswer.builder()
                    .examSession(session)
                    .question(question)
                    .answerText(answerText)
                    .earnedScore(earned)
                    .selectedChoices(selectedEntities)
                    .build();
            submissionAnswerRepository.save(answer);
        }

        session.submit(totalScore);

        // 트랜잭션 커밋 후 Redis 정리 (실패가 DB 롤백을 유발하지 않도록)
        Long examId = exam.getId();
        String studentNumber = session.getStudentNumber();
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    answerDraftStore.clear(sessionUuid);
                    sessionLockStore.release(examId, studentNumber);
                }
            });
        }

        return new StudentResponse.SubmitResponse(
                session.getSessionUuid().toString(),
                session.getStatus(),
                session.getTotalScore(),
                session.getSubmittedAt()
        );
    }

    /**
     * 응시 활성 lock TTL 갱신. (백로그 20)
     * 클라이언트가 약 10초 주기로 호출. {@link SessionLockStore#tryAcquire}는
     * 본인 lock일 때 TTL을 갱신하고, 만료되어 비어있으면 재획득까지 처리한다.
     * 다른 sessionUuid가 점유 중이면 {@link ErrorCode#CONCURRENT_SESSION}.
     */
    @Transactional(readOnly = true)
    public void heartbeat(UUID sessionUuid) {
        ExamSession session = examSessionRepository.findBySessionUuid(sessionUuid)
                .orElseThrow(() -> new CustomException(ErrorCode.SESSION_NOT_FOUND));
        if (session.isSubmitted()) {
            throw new CustomException(ErrorCode.SESSION_ALREADY_SUBMITTED);
        }

        boolean ok = sessionLockStore.tryAcquire(
                session.getExam().getId(), session.getStudentNumber(), sessionUuid);
        if (!ok) {
            throw new CustomException(ErrorCode.CONCURRENT_SESSION);
        }
    }

    private void validateExamWindow(Exam exam) {
        OffsetDateTime now = OffsetDateTime.now();
        if (now.isBefore(exam.getStartsAt())) {
            throw new CustomException(ErrorCode.EXAM_NOT_STARTED);
        }
        if (now.isAfter(exam.getEndsAt())) {
            throw new CustomException(ErrorCode.EXAM_ENDED);
        }
    }

    private void validateRoster(Long examId, StudentRequest.SessionStartRequest request) {
        ExamRoster roster = examRosterRepository
                .findByExamIdAndStudentNumber(examId, request.studentNumber())
                .orElseThrow(() -> new CustomException(ErrorCode.STUDENT_NOT_IN_ROSTER));

        // 이름 불일치도 STUDENT_NOT_IN_ROSTER로 통합 (보안/UX 통일 결정)
        if (!roster.getStudentName().equals(request.studentName())) {
            throw new CustomException(ErrorCode.STUDENT_NOT_IN_ROSTER);
        }
    }

    /**
     * 동일 학번의 ExamSession을 찾거나 생성한다. (백로그 20 동시 응시 차단의 핵심)
     *
     * 기존 row 발견 시:
     *   - SUBMITTED → SESSION_ALREADY_SUBMITTED
     *   - Redis lock이 살아있음 → 다른 기기가 응시 중 → CONCURRENT_SESSION (409)
     *   - Redis lock이 만료(=30초 grace 지남) → sessionUuid를 새로 발급해서 이전 기기 토큰을 무효화한 뒤 재사용
     *
     * 이렇게 하면 동일 학번/이름으로 두 번째 기기가 진입해도 같은 sessionUuid를 받지 않으므로,
     * 후속 {@link SessionLockStore#tryAcquire}의 "본인 sessionUuid면 통과" 분기를 우회하지 않는다.
     */
    private ExamSession findOrCreateSession(Exam exam, StudentRequest.SessionStartRequest request) {
        return examSessionRepository
                .findByExamIdAndStudentNumber(exam.getId(), request.studentNumber())
                .map(existing -> {
                    if (existing.isSubmitted()) {
                        throw new CustomException(ErrorCode.SESSION_ALREADY_SUBMITTED);
                    }
                    if (sessionLockStore.isHeld(exam.getId(), existing.getStudentNumber())) {
                        throw new CustomException(ErrorCode.CONCURRENT_SESSION);
                    }
                    existing.regenerateSessionUuid();
                    return existing;
                })
                .orElseGet(() -> examSessionRepository.save(
                        ExamSession.builder()
                                .exam(exam)
                                .studentNumber(request.studentNumber())
                                .studentName(request.studentName())
                                .build()));
    }

    private StudentResponse.SessionStartResponse buildSessionStartResponse(Exam exam, ExamSession session) {
        List<StudentResponse.StudentQuestionDto> questions = exam.getQuestions().stream()
                .sorted(Comparator.comparing(Question::getDisplayOrder))
                .map(this::toStudentQuestionDto)
                .collect(Collectors.toList());

        return new StudentResponse.SessionStartResponse(
                session.getSessionUuid().toString(),
                exam.getTitle(),
                exam.getStartsAt(),
                exam.getEndsAt(),
                questions
        );
    }

    private StudentResponse.StudentQuestionDto toStudentQuestionDto(Question q) {
        List<StudentResponse.StudentImageDto> images = q.getImages().stream()
                .map(img -> new StudentResponse.StudentImageDto(
                        img.getId(), "/api/v1/files/images/" + img.getFilePath()))
                .collect(Collectors.toList());

        // QuestionChoice.isCorrect 의도적 미노출
        List<StudentResponse.StudentChoiceDto> choices = q.getChoices().stream()
                .sorted(Comparator.comparing(c -> c.getDisplayOrder()))
                .map(c -> new StudentResponse.StudentChoiceDto(c.getId(), c.getBody(), c.getDisplayOrder()))
                .collect(Collectors.toList());

        // Question.correctAnswer 의도적 미노출
        return new StudentResponse.StudentQuestionDto(
                q.getId(),
                q.getQuestionType().name(),
                q.getBody(),
                q.getPoints(),
                q.getDisplayOrder(),
                images,
                choices
        );
    }
}
