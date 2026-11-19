package com.sportify.sportifybackend.controller;

import com.sportify.sportifybackend.dto.response.FieldResponse;
import com.sportify.sportifybackend.dto.response.SportComplexResponse;
import com.sportify.sportifybackend.entity.Field;
import com.sportify.sportifybackend.service.CatalogService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;

import java.util.List;

@RestController
@RequestMapping("/api/v1")
public class CatalogController {

    private final CatalogService catalogService;

    public CatalogController(CatalogService catalogService) {
        this.catalogService = catalogService;
    }

    @GetMapping("/complexes")
    public List<SportComplexResponse> listComplexes() {
        return catalogService.listComplexes();
    }

    @GetMapping("/fields")
    public List<FieldResponse> listFields(
            @RequestParam(name = "city", defaultValue = "") String city,
            @RequestParam(name = "sport", required = false) Field.SportType sport
    ) {
        return catalogService.listFields(city, sport);
    }

    @GetMapping("/fields/{id}")
    public ResponseEntity<FieldResponse> getField(@PathVariable("id") Long id) {
        return ResponseEntity.of(catalogService.findField(id));
    }

    @ExceptionHandler(MethodArgumentTypeMismatchException.class)
    public ResponseEntity<Void> invalidParameter() {
        return ResponseEntity.badRequest().build();
    }
}