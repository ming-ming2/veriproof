package com.example.veriproof.domain.report.repository;

import com.example.veriproof.domain.exam.entity.ExamSession;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.List;

// SQL문을 쓰는게 더 유리
public interface ReportRepository extends JpaRepository<ExamSession, Long> {

    @Query(value = "SELECT " +
            "  (SELECT COUNT(*) FROM exam_roster WHERE exam_id = :examId) as rosterCount, " +
            "  COUNT(*) as takerCount, " +
            "  COUNT(CASE WHEN status = 'SUBMITTED' THEN 1 END) as submittedCount, " +
            "  COALESCE(AVG(CASE WHEN status = 'SUBMITTED' THEN total_score END), 0.0) as avgScore, " +
            "  COALESCE(AVG(CASE WHEN status = 'SUBMITTED' THEN EXTRACT(EPOCH FROM (submitted_at - started_at)) * 1000 END), 0.0) as avgDurationMs " +
            "FROM exam_session " +
            "WHERE exam_id = :examId", nativeQuery = true)
    SummaryProjection findSummaryByExamId(@Param("examId") Long examId);

    interface SummaryProjection {
        int getRosterCount();
        int getTakerCount();
        int getSubmittedCount();
        double getAvgScore();
        Double getAvgDurationMs();
    }

    @Query(value = "SELECT event_type as eventType, COUNT(*) as count " +
            "FROM event_log " +
            "WHERE exam_id = :examId " +
            "GROUP BY event_type", nativeQuery = true)
    List<SignalCountProjection> countSignalsByExamId(@Param("examId") Long examId);

    interface SignalCountProjection {
        String getEventType();
        long getCount();
    }

    @Query(value = "SELECT COUNT(*) " +
            "FROM event_log e1 " +
            "WHERE e1.exam_id = :examId " +
            "  AND e1.event_type = 'PASTE' " +
            "  AND EXISTS ( " +
            "    SELECT 1 FROM event_log e2 " +
            "    WHERE e2.exam_session_id = e1.exam_session_id " +
            "      AND e2.event_type IN ('VISIBILITY_RESTORED', 'FULLSCREEN_ENTER') " +
            "      AND e1.occurred_at >= e2.occurred_at " +
            "      AND e1.occurred_at <= e2.occurred_at + INTERVAL '5 seconds' " +
            "  )", nativeQuery = true)
    long countPasteAfterReturn(@Param("examId") Long examId);

    @Query(value = "SELECT " +
            "  es.id as sessionId, " +
            "  es.session_uuid as sessionUuid, " +
            "  es.student_number as studentNumber, " +
            "  es.student_name as studentName, " +
            "  es.status as status, " +
            "  es.total_score as totalScore, " +
            "  CASE WHEN es.status = 'SUBMITTED' THEN EXTRACT(EPOCH FROM (es.submitted_at - es.started_at)) * 1000 ELSE NULL END as durationMs, " +
            "  COALESCE(score_table.score, 0) as attentionScore " +
            "FROM exam_session es " +
            "LEFT JOIN ( " +
            "  SELECT exam_session_id, COUNT(*) as score " +
            "  FROM event_log " +
            "  WHERE event_type IN ('PASTE', 'VISIBILITY_RESTORED', 'FULLSCREEN_ENTER', 'FULLSCREEN_EXIT', 'CAPTURE_SHORTCUT', 'WINDOW_BLUR', 'SUSPICIOUS_CHOICE_CHANGE') " +
            "  GROUP BY exam_session_id " +
            ") score_table ON es.id = score_table.exam_session_id " +
            "WHERE es.exam_id = :examId " +
            "ORDER BY attentionScore DESC, es.student_number ASC", nativeQuery = true)
    List<StudentReportProjection> findStudentReportsByExamId(@Param("examId") Long examId);

    interface StudentReportProjection {
        Long getSessionId();
        String getSessionUuid();
        String getStudentNumber();
        String getStudentName();
        String getStatus();
        Integer getTotalScore();
        Double getDurationMs();
        int getAttentionScore();
    }
}