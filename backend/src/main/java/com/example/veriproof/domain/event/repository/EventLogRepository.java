package com.example.veriproof.domain.event.repository;

import com.example.veriproof.domain.event.entity.EventLog;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.OffsetDateTime;
import java.util.List;

@Repository
public interface EventLogRepository extends JpaRepository<EventLog, Long> {

    /**
     * 사후 재생(백로그 15)용. 한 세션의 모든 이벤트를 시간순으로.
     * 동일 occurredAt 이벤트(CHOICE_CHANGE + 파생 SUSPICIOUS_CHOICE_CHANGE 등) 간 순서 안정성을 위해 id ASC 보조 정렬.
     */
    List<EventLog> findAllByExamSessionIdOrderByOccurredAtAscIdAsc(Long examSessionId);

    /** 감독관 이벤트 피드(백로그 18) 초기 적재 / 폴백 GET. 시간 역순. */
    List<EventLog> findAllByExamIdAndOccurredAtAfterOrderByOccurredAtDesc(
            Long examId, OffsetDateTime since, Pageable pageable);

    /**
     * 감독관 피드 / 학생 상세 — 부정행위 의심 이벤트만 (KEYSTROKE/CHOICE_CHANGE/QUESTION_NAVIGATE 제외).
     */
    @Query("""
            SELECT e FROM EventLog e
             WHERE e.exam.id = :examId
               AND e.occurredAt > :since
               AND e.eventType IN :types
             ORDER BY e.occurredAt DESC
            """)
    List<EventLog> findCheatingEventsByExam(@Param("examId") Long examId,
                                            @Param("since") OffsetDateTime since,
                                            @Param("types") java.util.Collection<String> types,
                                            Pageable pageable);

    /** 학생 상세 패널(백로그 17)의 최근 이벤트 목록. */
    List<EventLog> findAllByExamSessionIdOrderByOccurredAtDesc(Long examSessionId, Pageable pageable);

    /** 학생 상세 — 부정행위 의심 이벤트만 시간 역순. */
    @Query("""
            SELECT e FROM EventLog e
             WHERE e.examSession.id = :sessionId
               AND e.eventType IN :types
             ORDER BY e.occurredAt DESC
            """)
    List<EventLog> findCheatingEventsBySession(@Param("sessionId") Long sessionId,
                                               @Param("types") java.util.Collection<String> types,
                                               Pageable pageable);

    /**
     * VISIBILITY_RESTORED / FULLSCREEN_ENTER 도착 시 페어링 대상 LOST/EXIT 조회.
     * 같은 세션의 가장 최근 동종 시작 이벤트 (도착 시각 이전).
     * duration_ms는 RESTORED/ENTER row에 기록되므로 LOST/EXIT 쪽엔 NULL 필터를 걸지 않는다.
     * Pageable로 limit 1을 전달.
     */
    @Query("""
            SELECT e FROM EventLog e
             WHERE e.examSession.id = :sessionId
               AND e.eventType = :startType
               AND e.occurredAt < :before
             ORDER BY e.occurredAt DESC
            """)
    List<EventLog> findLatestStartBefore(@Param("sessionId") Long sessionId,
                                         @Param("startType") String startType,
                                         @Param("before") OffsetDateTime before,
                                         Pageable pageable);

    /** 학생 상세 패널의 평균 이탈 지속시간. */
    @Query("""
            SELECT AVG(e.durationMs) FROM EventLog e
             WHERE e.examSession.id = :sessionId
               AND e.eventType = 'VISIBILITY_RESTORED'
               AND e.durationMs IS NOT NULL
            """)
    Double avgVisibilityDurationMs(@Param("sessionId") Long sessionId);

    /**
     * SUSPICIOUS_CHOICE_CHANGE 파생용 (백로그 14).
     * 같은 세션의 VISIBILITY_RESTORED 또는 FULLSCREEN_ENTER 중 도착 시각 이전의 가장 최근 1건.
     * Pageable로 limit 1을 전달.
     */
    @Query("""
            SELECT e FROM EventLog e
             WHERE e.examSession.id = :sessionId
               AND e.eventType IN ('VISIBILITY_RESTORED', 'FULLSCREEN_ENTER')
               AND e.occurredAt < :before
             ORDER BY e.occurredAt DESC
            """)
    List<EventLog> findLatestReturnBefore(@Param("sessionId") Long sessionId,
                                          @Param("before") OffsetDateTime before,
                                          Pageable pageable);
}
