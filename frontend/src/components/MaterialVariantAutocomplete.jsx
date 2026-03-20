import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

/**
 * Autocomplete component for Material Variant fields (rating, size, material_make)
 * Provides suggestions based on previously entered values for the same material
 */
const MaterialVariantAutocomplete = ({
    materialId,
    field,
    value,
    onChange,
    label,
    placeholder = "Type to search or enter new value...",
    disabled = false
}) => {
    const [allSuggestions, setAllSuggestions] = useState([]); // All available suggestions
    const [filteredSuggestions, setFilteredSuggestions] = useState([]); // Filtered based on input
    const [showDropdown, setShowDropdown] = useState(false);
    const [loading, setLoading] = useState(false);
    const dropdownRef = useRef(null);
    const inputRef = useRef(null);

    // Fetch all suggestions when material is selected
    useEffect(() => {
        if (!materialId) {
            setAllSuggestions([]);
            setFilteredSuggestions([]);
            return;
        }

        const fetchAllSuggestions = async () => {
            setLoading(true);
            try {
                const token = localStorage.getItem('token');
                const response = await axios.get(
                    `${API_URL}/materials/${materialId}/variant-suggestions`,
                    {
                        params: { field, search: '' }, // Empty search to get all
                        headers: { Authorization: `Bearer ${token}` }
                    }
                );
                setAllSuggestions(response.data || []);
                setFilteredSuggestions(response.data || []);
            } catch (error) {
                console.error('Error fetching suggestions:', error);
                setAllSuggestions([]);
                setFilteredSuggestions([]);
            } finally {
                setLoading(false);
            }
        };

        fetchAllSuggestions();
    }, [materialId, field]);

    // Filter suggestions based on input value
    useEffect(() => {
        if (!value || value.trim() === '') {
            setFilteredSuggestions(allSuggestions);
        } else {
            const filtered = allSuggestions.filter(suggestion =>
                suggestion.value.toLowerCase().includes(value.toLowerCase())
            );
            setFilteredSuggestions(filtered);
        }
    }, [value, allSuggestions]);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setShowDropdown(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleSelect = (selectedValue) => {
        onChange(selectedValue);
        setShowDropdown(false);
        inputRef.current?.blur();
    };

    const handleInputChange = (e) => {
        onChange(e.target.value);
        setShowDropdown(true);
    };

    const handleFocus = () => {
        // Show all suggestions when field is focused
        if (materialId) {
            setShowDropdown(true);
        }
    };

    return (
        <div className="autocomplete-container" ref={dropdownRef} style={{ position: 'relative' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                {label}
            </label>
            <input
                ref={inputRef}
                type="text"
                className="glass-input"
                value={value || ''}
                onChange={handleInputChange}
                onFocus={handleFocus}
                placeholder={placeholder}
                disabled={disabled}
            />

            {showDropdown && filteredSuggestions.length > 0 && (
                <div
                    className="autocomplete-dropdown"
                    style={{
                        position: 'absolute',
                        top: '100%',
                        left: 0,
                        right: 0,
                        backgroundColor: '#1a1a2e',
                        border: '1px solid rgba(100, 200, 255, 0.3)',
                        borderRadius: '8px',
                        marginTop: '4px',
                        maxHeight: '200px',
                        overflowY: 'auto',
                        boxShadow: '0 8px 16px rgba(0, 0, 0, 0.4)',
                        zIndex: 1000
                    }}
                >
                    {filteredSuggestions.map((suggestion, index) => (
                        <div
                            key={index}
                            onClick={() => handleSelect(suggestion.value)}
                            style={{
                                padding: '0.75rem',
                                cursor: 'pointer',
                                borderBottom: index < filteredSuggestions.length - 1 ? '1px solid rgba(255,255,255,0.1)' : 'none',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                backgroundColor: 'transparent',
                                transition: 'background-color 0.2s'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(100, 200, 255, 0.1)'}
                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                        >
                            <span style={{ fontWeight: '600', color: '#fff', fontSize: '0.9rem' }}>{suggestion.value}</span>
                            <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.6)' }}>
                                Used {suggestion.count} {suggestion.count === 1 ? 'time' : 'times'}
                            </span>
                        </div>
                    ))}
                </div>
            )}

            {loading && (
                <div style={{
                    position: 'absolute',
                    right: '10px',
                    top: '38px',
                    fontSize: '0.75rem',
                    color: '#666'
                }}>
                    Loading...
                </div>
            )}
        </div>
    );
};

export default MaterialVariantAutocomplete;
