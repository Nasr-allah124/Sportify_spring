package com.sportify.sportifybackend.dto.response;

import com.sportify.sportifybackend.entity.Field;

import java.math.BigDecimal;

public record FieldResponse(
        Long id,
        String name,
        Field.SportType sportType,
        BigDecimal hourlyPrice,
        SportComplexResponse complex
) {
    public static FieldResponse from(Field field) {
        return new FieldResponse(
                field.getId(),
                field.getName(),
                field.getSportType(),
                field.getHourlyPrice(),
                SportComplexResponse.from(field.getComplex())
        );
    }
}