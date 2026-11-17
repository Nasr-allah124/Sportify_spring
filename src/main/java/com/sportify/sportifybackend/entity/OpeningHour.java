package com.sportify.sportifybackend.entity;

import jakarta.persistence.*;
import lombok.Getter;

import java.time.DayOfWeek;
import java.time.LocalTime;

@Entity
@Table(
        name = "opening_hours",
        uniqueConstraints = @UniqueConstraint(
                name = "uq_opening_hours_complex_day",
                columnNames = {"complex_id", "day_of_week"}
        )
)
@Getter
public class OpeningHour {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "complex_id", nullable = false)
    private SportComplex complex;

    @Enumerated(EnumType.STRING)
    @Column(name = "day_of_week", nullable = false, length = 10)
    private DayOfWeek dayOfWeek;

    @Column(name = "opening_time", nullable = false)
    private LocalTime openingTime;

    @Column(name = "closing_time", nullable = false)
    private LocalTime closingTime;

    protected OpeningHour() {
    }
}