package com.example.veriproof.infra.storage;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.util.UUID;

@Service
public class FileStorageService {

    private final Path fileStorageLocation;

    // application.yml 등에 설정된 경로를 주입받음 (예: ./uploads/images)
    public FileStorageService(@Value("${file.upload-dir:./uploads/images}") String uploadDir) {
        this.fileStorageLocation = Paths.get(uploadDir).toAbsolutePath().normalize();
        try {
            Files.createDirectories(this.fileStorageLocation);
        } catch (Exception ex) {
            throw new RuntimeException("업로드 디렉토리를 생성할 수 없습니다.", ex);
        }
    }

    public String storeFile(MultipartFile file) {
        String originalFileName = StringUtils.cleanPath(file.getOriginalFilename());
        try {
            // 디렉토리 트래버셜 공격 방지
            if (originalFileName.contains("..")) {
                throw new IllegalArgumentException("올바르지 않은 파일 경로가 포함되어 있습니다: " + originalFileName);
            }

            // 파일명 충돌 방지를 위한 UUID 적용
            String extension = StringUtils.getFilenameExtension(originalFileName);
            String newFileName = UUID.randomUUID().toString() + "." + extension;

            Path targetLocation = this.fileStorageLocation.resolve(newFileName);

            // 기존 파일이 있다면 덮어쓰기 옵션
            Files.copy(file.getInputStream(), targetLocation, StandardCopyOption.REPLACE_EXISTING);

            return newFileName;
        } catch (IOException ex) {
            throw new RuntimeException("파일을 저장할 수 없습니다: " + originalFileName, ex);
        }
    }

    // DB 트랜잭션 롤백 시 파일을 삭제하기 위한 보상 트랜잭션 메서드
    public void deleteFile(String fileName) {
        try {
            Path targetLocation = this.fileStorageLocation.resolve(fileName);
            Files.deleteIfExists(targetLocation);
        } catch (IOException e) {
            // 삭제 실패 시 에러 로그 기록 (추후 배치로 쓰레기 파일 정리 가능)
        }
    }
}