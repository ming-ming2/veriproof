package com.example.veriproof.domain.exam.service;

import com.example.veriproof.domain.exam.dto.Response;
import com.example.veriproof.domain.exam.entity.Exam;
import com.example.veriproof.domain.exam.entity.Question;
import com.example.veriproof.domain.exam.entity.QuestionImage;
import com.example.veriproof.domain.exam.repository.ExamRepository;
import com.example.veriproof.domain.exam.repository.QuestionImageRepository;
import com.example.veriproof.domain.exam.repository.QuestionRepository;
import com.example.veriproof.infra.storage.FileStorageService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

@Service
@RequiredArgsConstructor
public class ImageUploadService {

    private final ExamRepository examRepository;
    private final QuestionRepository questionRepository;
    private final QuestionImageRepository questionImageRepository;
    private final FileStorageService fileStorageService;

    // 허용되는 MIME 타입 (API Spec 기준)
    private static final List<String> ALLOWED_MIME_TYPES = List.of(
            "image/png", "image/jpeg", "image/gif", "image/webp"
    );
    private static final long MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

    @Transactional
    public Response.ImageUploadResponse uploadQuestionImage(
            Long professorId, Long examId, Long questionId, MultipartFile file) {

        // 1. 파일 규격 검증 (API 스펙 준수)
        validateFile(file);

        // 2. 권한 및 존재 여부 검증
        Exam exam = examRepository.findById(examId)
                .orElseThrow(() -> new IllegalArgumentException("Exam not found"));

        if (!exam.getProfessor().getId().equals(professorId)) {
            throw new SecurityException("해당 시험에 대한 권한이 없습니다.");
        }

        Question question = questionRepository.findById(questionId)
                .orElseThrow(() -> new IllegalArgumentException("Question not found"));

        if (!question.getExam().getId().equals(examId)) {
            throw new IllegalArgumentException("문항이 해당 시험에 속하지 않습니다.");
        }

        // 3. 인프라 계층(로컬 스토리지)에 파일 저장
        String storedFileName = fileStorageService.storeFile(file);

        try {
            // 4. DB 메타데이터 저장
            QuestionImage questionImage = QuestionImage.builder()
                    .question(question)
                    .filePath(storedFileName) // 실제로는 클라우드 URL이나 로컬 경로
                    .originalName(file.getOriginalFilename())
                    .mimeType(file.getContentType())
                    .sizeBytes(file.getSize())
                    .build();

            QuestionImage savedImage = questionImageRepository.save(questionImage);

            // 5. API 응답 규격에 맞추어 반환
            String fileUrl = "/api/v1/files/images/" + storedFileName; // 파일을 서빙할 API URL

            return new Response.ImageUploadResponse(
                    savedImage.getId(),
                    fileUrl,
                    savedImage.getOriginalName(),
                    savedImage.getSizeBytes()
            );
        } catch (Exception e) {
            // DB 저장이 실패했다면 물리적 파일도 롤백해야 합니다. (보상 트랜잭션)
            fileStorageService.deleteFile(storedFileName);
            throw e;
        }
    }

    private void validateFile(MultipartFile file) {
        if (file.isEmpty()) {
            throw new IllegalArgumentException("파일이 비어있습니다.");
        }
        if (file.getSize() > MAX_FILE_SIZE) {
            throw new IllegalArgumentException("파일 크기는 5MB를 초과할 수 없습니다.");
        }
        if (!ALLOWED_MIME_TYPES.contains(file.getContentType())) {
            throw new IllegalArgumentException("지원하지 않는 이미지 포맷입니다. (PNG, JPEG, GIF, WEBP만 허용)");
        }
    }
}