package com.sportify.sportifybackend.entity;

import jakarta.persistence.*;

@Entity
@Table(
        name = "complex_photos",
        uniqueConstraints = @UniqueConstraint(columnNames = {"complex_id", "position"})
)
public class ComplexPhoto {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "complex_id", nullable = false)
    private SportComplex complex;

    @Column(nullable = false)
    private int position;

    @Column(name = "content_type", nullable = false, length = 30)
    private String contentType;

    @Column(nullable = false, columnDefinition = "bytea")
    private byte[] content;

    protected ComplexPhoto() {}
}