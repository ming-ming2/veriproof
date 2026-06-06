package com.example.veriproof.domain.student.service;

import com.example.veriproof.domain.exam.entity.Exam;
import com.example.veriproof.domain.exam.entity.ExamSession;
import com.example.veriproof.domain.exam.repository.ExamRepository;
import com.example.veriproof.domain.exam.repository.ExamRosterRepository;
import com.example.veriproof.domain.exam.repository.ExamSessionRepository;
import com.example.veriproof.domain.exam.repository.SubmissionAnswerRepository;
import com.example.veriproof.infra.redis.ActiveSessionStore;
import com.example.veriproof.infra.redis.AnswerDraftStore;
import com.example.veriproof.infra.redis.SessionLockStore;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/**
 * 만료 세션 자동 제출 서비스 로직 단위 테스트. (백로그 21)
 * 핵심: (1) 수동 제출과의 경합 시 조용히 skip, (2) 만료 폴백 제출 시 autoSubmitted=true 추론.
 */
@ExtendWith(MockitoExtension.class)
class StudentSessionServiceAutoSubmitTest {

    @Mock private ExamRepository examRepository;
    @Mock private ExamRosterRepository examRosterRepository;
    @Mock private ExamSessionRepository examSessionRepository;
    @Mock private SubmissionAnswerRepository submissionAnswerRepository;
    @Mock private SessionLockStore sessionLockStore;
    @Mock private AnswerDraftStore answerDraftStore;
    @Mock private AutoGradingService autoGradingService;
    @Mock private ActiveSessionStore activeSessionStore;

    @InjectMocks
    private StudentSessionService studentSessionService;

    @Test
    @DisplayName("세션이 존재하지 않으면 채점/제출 없이 조용히 skip")
    void missingSession_skipsSilently() {
        when(examSessionRepository.findById(99L)).thenReturn(Optional.empty());

        studentSessionService.autoSubmitExpiredSession(99L);

        verifyNoInteractions(answerDraftStore, submissionAnswerRepository, autoGradingService);
    }

    @Test
    @DisplayName("이미 제출(SUBMITTED)된 세션이면 — 수동 제출과의 경합 — 조용히 skip")
    void alreadySubmittedSession_skipsSilently() {
        ExamSession session = mock(ExamSession.class);
        when(session.isInProgress()).thenReturn(false); // 수동 제출이 먼저 커밋된 상태
        when(examSessionRepository.findById(1L)).thenReturn(Optional.of(session));

        studentSessionService.autoSubmitExpiredSession(1L);

        verify(session, never()).submit(anyInt(), anyBoolean());
        verifyNoInteractions(answerDraftStore, submissionAnswerRepository, autoGradingService);
    }

    @Test
    @DisplayName("종료 시각이 지난 IN_PROGRESS 세션은 autoSubmitted=true 로 제출된다")
    void inProgressExpiredSession_submittedAsAuto() {
        UUID sessionUuid = UUID.randomUUID();
        Exam exam = mock(Exam.class);
        when(exam.getId()).thenReturn(7L);
        when(exam.getQuestions()).thenReturn(List.of()); // 문항 순회 없음
        when(exam.getEndsAt()).thenReturn(OffsetDateTime.now().minusHours(1)); // 이미 만료

        ExamSession session = mock(ExamSession.class);
        when(session.isInProgress()).thenReturn(true);
        when(session.getExam()).thenReturn(exam);
        when(session.getSessionUuid()).thenReturn(sessionUuid);
        when(session.getStudentNumber()).thenReturn("20250001");
        when(examSessionRepository.findById(2L)).thenReturn(Optional.of(session));
        when(answerDraftStore.getAll(sessionUuid)).thenReturn(Map.of());

        studentSessionService.autoSubmitExpiredSession(2L);

        // 종료 시각 이후 제출 → autoSubmitted=true, 문항 없으니 총점 0
        verify(session).submit(0, true);
    }
}
