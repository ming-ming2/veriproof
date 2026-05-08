package com.example.veriproof.domain.exam.service;

import com.example.veriproof.domain.exam.dto.Response;
import com.example.veriproof.domain.exam.entity.Exam;
import com.example.veriproof.domain.exam.entity.Question;
import com.example.veriproof.domain.exam.entity.QuestionImage;
import com.example.veriproof.domain.exam.repository.ExamRepository;
import com.example.veriproof.domain.exam.repository.QuestionImageRepository;
import com.example.veriproof.domain.exam.repository.QuestionRepository;
import com.example.veriproof.global.exception.CustomException;
import com.example.veriproof.global.exception.ErrorCode;
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

        // 1. 파일 규격 검증
        validateFile(file);

        // 2. 권한 및 존재 여부 검증
        Exam exam = examRepository.findById(examId)
                .orElseThrow(() -> new CustomException(ErrorCode.EXAM_NOT_FOUND));

        if (!exam.getProfessor().getId().equals(professorId)) {
            throw new CustomException(ErrorCode.FORBIDDEN);
        }

        Question question = questionRepository.findById(questionId)
                .orElseThrow(() -> new CustomException(ErrorCode.QUESTION_NOT_FOUND));

        if (!question.getExam().getId().equals(examId)) {
            throw new CustomException(ErrorCode.QUESTION_NOT_IN_EXAM);
        }

        // 3. 인프라 계층(로컬 스토리지)에 파일 저장
        String storedFileName = fileStorageService.storeFile(file);

        try {
            // 4. DB 메타데이터 저장
            QuestionImage questionImage = QuestionImage.builder()
                    .question(question)
                    .filePath(storedFileName)
                    .originalName(file.getOriginalFilename())
                    .mimeType(file.getContentType())
                    .sizeBytes(file.getSize())
                    .build();

            QuestionImage savedImage = questionImageRepository.save(questionImage);

            String fileUrl = "/api/v1/files/images/" + storedFileName;

            return new Response.ImageUploadResponse(
                    savedImage.getId(),
                    fileUrl,
                    savedImage.getOriginalName(),
                    savedImage.getSizeBytes()
            );
        } catch (Exception e) {
            // DB 저장이 실패했다면 물리적 파일도 롤백 (보상 트랜잭션)
            fileStorageService.deleteFile(storedFileName);
            throw e;
        }
    }

    private void validateFile(MultipartFile file) {
        if (file.isEmpty()) {
            throw new CustomException(ErrorCode.INVALID_FILE);
        }
        if (file.getSize() > MAX_FILE_SIZE) {
            throw new CustomException(ErrorCode.FILE_TOO_LARGE);
        }
        if (!ALLOWED_MIME_TYPES.contains(file.getContentType())) {
            throw new CustomException(ErrorCode.UNSUPPORTED_FILE_TYPE);
        }
    }
}
