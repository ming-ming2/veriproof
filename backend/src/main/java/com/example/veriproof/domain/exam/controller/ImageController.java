package com.example.veriproof.domain.exam.controller;

import com.example.veriproof.infra.storage.FileStorageService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.core.io.Resource;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.io.IOException;
import java.nio.file.Files;

@Tag(name = "Files", description = "파일 리소스 제공 API")
@RestController
@RequestMapping("/api/v1/files")
@RequiredArgsConstructor
public class ImageController {

    private final FileStorageService fileStorageService;

    @Operation(summary = "이미지 스트리밍", description = "저장된 이미지 파일을 브라우저에 표시합니다.")
    @GetMapping("/images/{fileName:.+}")
    public ResponseEntity<Resource> getImage(@PathVariable String fileName) {
        // 1. 서비스로부터 파일 리소스 로드
        Resource resource = fileStorageService.loadFileAsResource(fileName);

        // 2. 파일의 확장자를 기반으로 Content-Type 추출 (image/png 등)
        String contentType;
        try {
            contentType = Files.probeContentType(resource.getFile().toPath());
        } catch (IOException e) {
            contentType = "application/octet-stream";
        }

        // 3. HTTP 응답 전송
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(contentType))
                .body(resource);
    }
}