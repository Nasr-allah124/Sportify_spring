package com.sportify.sportifybackend.entity;

import jakarta.persistence.*;
import lombok.Getter;

import java.time.Instant;

@Entity
@Table(name = "owner_applications")
@Getter
public class OwnerApplication {

    public enum Status {
        PENDING, APPROVED, REJECTED
    }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "applicant_id", nullable = false)
    private User applicant;

    @Column(name = "complex_name", nullable = false, length = 150)
    private String complexName;

    @Column(nullable = false, length = 100)
    private String city;

    @Column(nullable = false, length = 255)
    private String address;

    @Column(nullable = false, length = 30)
    private String phone;

    @Column(length = 2000)
    private String description;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private Status status = Status.PENDING;

    @Column(name = "submitted_at", nullable = false, updatable = false)
    private Instant submittedAt = Instant.now();

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "reviewed_by")
    private User reviewedBy;

    @Column(name = "reviewed_at")
    private Instant reviewedAt;

    @Column(name = "rejection_reason", length = 1000)
    private String rejectionReason;
    @Column(name = "latitude")
    private Double latitude;

    @Column(name = "longitude")
    private Double longitude;

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "created_complex_id", unique = true)
    private SportComplex createdComplex;

    protected OwnerApplication() {
    }public OwnerApplication(
            User applicant,
            String complexName,
            String city,
            String address,
            String phone,
            String description,
            Double latitude,
            Double longitude
    ) {
        this.applicant = applicant;
        this.complexName = complexName.strip();
        this.city = city.strip();
        this.address = address.strip();
        this.phone = phone.strip();
        this.description = description == null || description.isBlank()
                ? null
                : description.strip();
        this.latitude = latitude;
        this.longitude = longitude;
    }
}