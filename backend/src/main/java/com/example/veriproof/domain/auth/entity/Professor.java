package com.example.veriproof.domain.auth.entity;

import com.example.veriproof.global.entity.BaseTimeEntity;
import jakarta.persistence.*;
import lombok.*;

@Entity
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Table(name = "professor")
public class Professor extends BaseTimeEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(unique = true, nullable = false, length = 50)
    private String username;

    @Column(name = "password_hash", nullable = false, length = 60)
    private String passwordHash;

    @Column(nullable = false, length = 100)
    private String name;

    @Column(nullable = false, length = 200)
    private String affiliation;

    @Builder
    public Professor(String username, String passwordHash, String name, String affiliation) {
        this.username = username;
        this.passwordHash = passwordHash;
        this.name = name;
        this.affiliation = affiliation;
    }

    public void updateProfile(String name, String affiliation) {
        if (name != null) this.name = name;
        if (affiliation != null) this.affiliation = affiliation;
    }

    public void updatePassword(String encodedPassword) {
        this.passwordHash = encodedPassword;
    }
}
