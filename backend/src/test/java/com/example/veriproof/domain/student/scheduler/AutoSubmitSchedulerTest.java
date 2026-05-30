package com.example.veriproof.domain.student.scheduler;

import com.example.veriproof.domain.exam.entity.ExamSession;
import com.example.veriproof.domain.exam.repository.ExamSessionRepository;
import com.example.veriproof.domain.student.service.StudentSessionService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.OffsetDateTime;
import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doNothing;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * 만료 자동 제출 스위퍼 단위 테스트. (백로그 21)
 * 스위퍼의 핵심 책임은 "세션별 실패 격리" — 한 세션이 터져도 나머지를 끝까지 제출해야 한다.
 */
@ExtendWith(MockitoExtension.class)
class AutoSubmitSchedulerTest {

    @Mock
    private ExamSessionRepository examSessionRepository;

    @Mock
    private StudentSessionService studentSessionService;

    @InjectMocks
    private AutoSubmitScheduler autoSubmitScheduler;

    @Test
    @DisplayName("만료 세션이 없으면 자동 제출을 한 건도 호출하지 않는다")
    void noExpiredSessions_doesNothing() {
        when(examSessionRepository.findIdsByStatusAndExamEndsAtBefore(
                eq(ExamSession.STATUS_IN_PROGRESS), any(OffsetDateTime.class)))
                .thenReturn(List.of());

        autoSubmitScheduler.sweepExpiredSessions();

        verify(studentSessionService, never()).autoSubmitExpiredSession(any());
    }

    @Test
    @DisplayName("만료된 모든 세션에 대해 자동 제출을 호출한다")
    void submitsEveryExpiredSession() {
        when(examSessionRepository.findIdsByStatusAndExamEndsAtBefore(
                eq(ExamSession.STATUS_IN_PROGRESS), any(OffsetDateTime.class)))
                .thenReturn(List.of(1L, 2L, 3L));
        doNothing().when(studentSessionService).autoSubmitExpiredSession(any());

        autoSubmitScheduler.sweepExpiredSessions();

        verify(studentSessionService).autoSubmitExpiredSession(1L);
        verify(studentSessionService).autoSubmitExpiredSession(2L);
        verify(studentSessionService).autoSubmitExpiredSession(3L);
    }

    @Test
    @DisplayName("한 세션의 제출이 예외로 실패해도 나머지 세션은 끝까지 제출된다")
    void onePerSessionFailure_doesNotStopTheRest() {
        when(examSessionRepository.findIdsByStatusAndExamEndsAtBefore(
                eq(ExamSession.STATUS_IN_PROGRESS), any(OffsetDateTime.class)))
                .thenReturn(List.of(1L, 2L, 3L));
        // 가운데 세션이 경합 등으로 터져도 1L, 3L은 처리되어야 한다.
        doNothing().when(studentSessionService).autoSubmitExpiredSession(1L);
        doThrow(new RuntimeException("경합으로 이미 제출됨"))
                .when(studentSessionService).autoSubmitExpiredSession(2L);
        doNothing().when(studentSessionService).autoSubmitExpiredSession(3L);

        autoSubmitScheduler.sweepExpiredSessions();

        verify(studentSessionService, times(1)).autoSubmitExpiredSession(1L);
        verify(studentSessionService, times(1)).autoSubmitExpiredSession(2L);
        verify(studentSessionService, times(1)).autoSubmitExpiredSession(3L);
    }
}
