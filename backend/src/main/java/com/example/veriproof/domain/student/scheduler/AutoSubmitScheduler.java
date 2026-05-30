package com.example.veriproof.domain.student.scheduler;

import com.example.veriproof.domain.exam.entity.ExamSession;
import com.example.veriproof.domain.exam.repository.ExamSessionRepository;
import com.example.veriproof.domain.student.service.StudentSessionService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.OffsetDateTime;
import java.util.List;

/**
 * 시간 만료 자동 제출 스위퍼. (백로그 21 #9)
 *
 * 만료 시점에 학생 네트워크가 끊겨 클라이언트 자동 제출이 도달하지 못하는 경우를 대비한
 * 서버 사이드 폴백. 주기적으로 종료 시각이 지났는데 아직 IN_PROGRESS인 세션을 찾아
 * 마지막 답안 초안(Redis draft, 자연 만료 endsAt+10분 전까지 생존) 기준으로 자동 제출한다.
 *
 * 세션마다 {@link StudentSessionService#autoSubmitExpiredSession(Long)}를 별도 트랜잭션으로
 * 호출하므로(다른 빈을 통한 프록시 경유) 한 세션 실패가 나머지를 막지 않는다.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class AutoSubmitScheduler {

    private final ExamSessionRepository examSessionRepository;
    private final StudentSessionService studentSessionService;

    @Scheduled(fixedDelayString = "${veriproof.auto-submit.sweep-interval-ms:60000}")
    public void sweepExpiredSessions() {
        List<Long> expiredIds = examSessionRepository
                .findIdsByStatusAndExamEndsAtBefore(ExamSession.STATUS_IN_PROGRESS, OffsetDateTime.now());
        if (expiredIds.isEmpty()) {
            return;
        }

        int submitted = 0;
        for (Long sessionId : expiredIds) {
            try {
                studentSessionService.autoSubmitExpiredSession(sessionId);
                submitted++;
            } catch (Exception e) {
                // 한 세션의 실패(경합으로 인한 이미 제출 등)가 나머지 스위핑을 막지 않도록 격리.
                log.warn("만료 세션 자동 제출 실패 — sessionId={}, cause={}", sessionId, e.getMessage());
            }
        }
        log.info("만료 세션 자동 제출 스위프 완료 — 대상 {}건, 제출 {}건", expiredIds.size(), submitted);
    }
}
