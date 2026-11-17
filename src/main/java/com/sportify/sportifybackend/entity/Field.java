package com.sportify.sportifybackend.entity;

import jakarta.persistence.*;
import lombok.Getter;

import java.math.BigDecimal;

@Entity
@Table(name = "fields")
@Getter
public class Field {

    public enum SportType {
        FOOTBALL, PADEL, TENNIS, BASKETBALL
    }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "complex_id", nullable = false)
    private SportComplex complex;

    @Column(nullable = false, length = 150)
    private String name;

    @Enumerated(EnumType.STRING)
    @Column(name = "sport_type", nullable = false, length = 30)
    private SportType sportType;

    @Column(name = "hourly_price", nullable = false, precision = 10, scale = 2)
    private BigDecimal hourlyPrice;

    private Integer capacity;

    @Column(length = 2000)
    private String description;

    @Column(nullable = false)
    private boolean active = true;

    protected Field() {
    }
}
