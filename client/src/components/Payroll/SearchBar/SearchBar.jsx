import React from 'react';
import { FiSearch, FiX } from 'react-icons/fi';
import './SearchBar.css';

export default function SearchBar({ value, onChange, placeholder = 'Search by Employee Code or Name...' }) {
  return (
    <div className="payroll-search-bar">
      <FiSearch className="search-icon" size={16} />
      <input
        type="text"
        className="search-input"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      {value && (
        <button
          type="button"
          className="search-clear-btn"
          onClick={() => onChange('')}
          title="Clear search"
          style={{ display: "flex", alignItems: "center", justifyContent: "center" }}
        >
          <FiX size={14} />
        </button>
      )}
    </div>
  );
}