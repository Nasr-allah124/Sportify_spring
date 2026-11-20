package com.sportify.sportifybackend.service;

import com.sportify.sportifybackend.dto.response.FieldResponse;
import com.sportify.sportifybackend.dto.response.SportComplexResponse;
import com.sportify.sportifybackend.entity.Field;
import com.sportify.sportifybackend.entity.SportComplex;
import com.sportify.sportifybackend.repository.FieldRepository;
import com.sportify.sportifybackend.repository.SportComplexRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.EnumSet;
import java.util.List;
import java.util.Optional;

@Service
@Transactional(readOnly = true)
public class CatalogService {

    private final SportComplexRepository complexes;
    private final FieldRepository fields;

    public CatalogService(SportComplexRepository complexes, FieldRepository fields) {
        this.complexes = complexes;
        this.fields = fields;
    }

    public List<SportComplexResponse> listComplexes() {
        return complexes.findByStatusOrderByIdAsc(SportComplex.Status.ACTIVE)
                .stream().map(SportComplexResponse::from).toList();
    }

    public List<FieldResponse> listFields(String city, Field.SportType sport) {
        var sports = sport == null
                ? EnumSet.allOf(Field.SportType.class)
                : EnumSet.of(sport);

        return fields.findVisibleFields(SportComplex.Status.ACTIVE, city.strip(), sports)
                .stream().map(FieldResponse::from).toList();
    }

    public Optional<FieldResponse> findField(Long id) {
        return fields.findByIdAndActiveTrueAndComplex_Status(id, SportComplex.Status.ACTIVE)
                .map(FieldResponse::from);
    }
}