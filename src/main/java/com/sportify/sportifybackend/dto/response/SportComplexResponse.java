package com.sportify.sportifybackend.dto.response;

import com.sportify.sportifybackend.entity.SportComplex;

public record SportComplexResponse(Long id, String name, String city, String address) {

    public static SportComplexResponse from(SportComplex complex) {
        return new SportComplexResponse(
                complex.getId(), complex.getName(), complex.getCity(), complex.getAddress()
        );
    }
}