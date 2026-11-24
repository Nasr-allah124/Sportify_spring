package com.sportify.sportifybackend.entity;

import jakarta.persistence.*;
import lombok.Getter;

@Entity
@Table(
        name = "field_images",
        uniqueConstraints = @UniqueConstraint(
                name = "uq_field_images_field_position",
                columnNames = {"field_id", "position"}
        )
)
@Getter
public class FieldImage {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "field_id", nullable = false)
    private Field field;

    @Column(name = "storage_key", nullable = false, length = 500)
    private String storageKey;

    @Column(nullable = false)
    private int position;

    @Column(name = "photo_bytes", columnDefinition = "bytea")
    private byte[] photoBytes;

    @Column(name = "photo_mime", length = 30)
    private String photoMime;

    protected FieldImage() {}
}