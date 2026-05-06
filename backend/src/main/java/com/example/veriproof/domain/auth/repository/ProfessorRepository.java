package com.example.veriproof.domain.auth.repository;

import com.example.veriproof.domain.auth.entity.Professor;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface ProfessorRepository extends JpaRepository<Professor, Long> {
    Optional<Professor> findByUsername(String username);
    boolean existsByUsername(String username);
}
