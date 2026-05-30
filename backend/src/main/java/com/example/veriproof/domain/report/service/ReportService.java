package com.example.veriproof.domain.report.service;

import com.example.veriproof.domain.exam.entity.Exam;
import com.example.veriproof.domain.exam.repository.ExamRepository;
import com.example.veriproof.domain.report.dto.ReportResponseDto;
import com.example.veriproof.domain.report.repository.ReportRepository;
import com.example.veriproof.global.exception.CustomException;
import com.example.veriproof.global.exception.ErrorCode;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class ReportService {

    private final ExamRepository examRepository;
    private final ReportRepository reportRepository;

    public ReportResponseDto generateReport(Long professorId, Long examId) {
        Exam exam = examRepository.findById(examId)
                .orElseThrow(() -> new CustomException(ErrorCode.EXAM_NOT_FOUND));

        if (!exam.getProfessor().getId().equals(professorId)) {
            throw new CustomException(ErrorCode.FORBIDDEN);
        }

        if (OffsetDateTime.now().isBefore(exam.getEndsAt())) {
            throw new CustomException(ErrorCode.EXAM_NOT_ENDED);
        }

        ReportRepository.SummaryProjection summaryProj = reportRepository.findSummaryByExamId(examId);
        ReportResponseDto.Summary summary = ReportResponseDto.Summary.builder()
                .rosterCount(summaryProj.getRosterCount())
                .takerCount(summaryProj.getTakerCount())
                .submittedCount(summaryProj.getSubmittedCount())
                .avgScore(Math.round(summaryProj.getAvgScore() * 10.0) / 10.0)
                .avgDurationMs(summaryProj.getAvgDurationMs() != null ? summaryProj.getAvgDurationMs().longValue() : 0L)
                .build();

        List<ReportRepository.SignalCountProjection> signalCounts = reportRepository.countSignalsByExamId(examId);

        long paste = 0, visibilityLost = 0, fullscreenExit = 0, captureShortcut = 0, suspiciousChoiceChange = 0;
        for (var row : signalCounts) {
            switch (row.getEventType()) {
                case "PASTE" -> paste = row.getCount();
                case "VISIBILITY_LOST" -> visibilityLost = row.getCount();
                case "FULLSCREEN_EXIT" -> fullscreenExit = row.getCount();
                case "CAPTURE_SHORTCUT" -> captureShortcut = row.getCount();
                case "SUSPICIOUS_CHOICE_CHANGE" -> suspiciousChoiceChange = row.getCount();
            }
        }

        ReportResponseDto.SignalDistribution signalDistribution = ReportResponseDto.SignalDistribution.builder()
                .paste(paste).visibilityLost(visibilityLost).fullscreenExit(fullscreenExit)
                .captureShortcut(captureShortcut).suspiciousChoiceChange(suspiciousChoiceChange)
                .build();

        ReportResponseDto.SuspiciousPatterns suspiciousPatterns = ReportResponseDto.SuspiciousPatterns.builder()
                .choiceChangeAfterReturn(suspiciousChoiceChange)
                .pasteAfterReturn(reportRepository.countPasteAfterReturn(examId))
                .build();

        List<ReportRepository.StudentReportProjection> studentProjs = reportRepository.findStudentReportsByExamId(examId);
        List<ReportResponseDto.StudentReportDto> studentReports = studentProjs.stream().map(proj -> {
            int score = proj.getAttentionScore();
            String level = "NORMAL";
            if (score >= 4) level = "HIGH";
            else if (score >= 2) level = "MID";
            else if (score >= 1) level = "LOW";

            return ReportResponseDto.StudentReportDto.builder()
                    .sessionId(proj.getSessionId())
                    .sessionUuid(proj.getSessionUuid())
                    .studentNumber(proj.getStudentNumber())
                    .studentName(proj.getStudentName())
                    .status(proj.getStatus())
                    .totalScore(proj.getTotalScore())
                    .durationMs(proj.getDurationMs() != null ? proj.getDurationMs().longValue() : null)
                    .attentionScore(score)
                    .attentionLevel(level)
                    .build();
        }).toList();

        return ReportResponseDto.builder()
                .examId(examId)
                .title(exam.getTitle())
                .endsAt(exam.getEndsAt())
                .summary(summary)
                .signalDistribution(signalDistribution)
                .suspiciousPatterns(suspiciousPatterns)
                .students(studentReports)
                .build();
    }
}