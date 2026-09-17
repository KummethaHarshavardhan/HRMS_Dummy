import React from 'react';
import { FiFolder } from 'react-icons/fi';
import Button from '../Button/Button';
import Input from '../Input/Input';
import Loader from '../Loader/Loader';
import './Table.css';

/**
 * Reusable Enterprise Table Component
 * - Unified responsive table inside dedicated horizontal-scroll wrapper
 * - Sticky table header (thead stays fixed during vertical scroll)
 * - Accepts maxHeight prop for fixed-height internal scroll container
 * - Supports: loading skeleton, empty state, searchable toolbar, pagination
 */
const Table = ({
  columns = [],
  data = [],
  loading = false,
  emptyText = 'No data available',
  searchable = false,
  searchValue = '',
  onSearchChange,
  pagination = null,
  onRowClick,
  maxHeight = null,   // e.g. '380px' to enable fixed-height internal scroll
  className = ''
}) => {
  return (
    <div className={`hrms-table-container ${className}`}>
      {/* Search / Toolbar header */}
      {searchable && (
        <div className="hrms-table-toolbar">
          <div className="hrms-table-search-wrapper">
            <Input
              type="search"
              placeholder="Search records..."
              value={searchValue}
              onChange={(e) => onSearchChange && onSearchChange(e.target.value)}
            />
          </div>
        </div>
      )}

      {/* Loading State */}
      {loading ? (
        <div style={{ padding: '24px' }}>
          <Loader.Skeleton type="title" />
          <Loader.Skeleton rows={5} />
        </div>
      ) : data.length === 0 ? (
        /* Empty State */
        <div className="hrms-table-empty">
          <span className="hrms-table-empty-icon"><FiFolder size={32} /></span>
          <span className="hrms-table-empty-text">{emptyText}</span>
        </div>
      ) : (
        /* Unified table with sticky thead + scrollable wrapper */
        <div className="hrms-table-outer">
          <div
            className="hrms-table-scroll-body"
            style={maxHeight ? { maxHeight, overflowY: 'auto' } : {}}
          >
            <table className="hrms-table">
              <thead>
                <tr>
                  {columns.map((col, idx) => (
                    <th
                      key={col.key || idx}
                      style={{
                        width: col.width || 'auto',
                        minWidth: col.minWidth || 'auto',
                        textAlign: col.align || 'left'
                      }}
                    >
                      {col.header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.map((row, rowIndex) => (
                  <tr
                    key={row._id || row.id || rowIndex}
                    className={onRowClick ? 'hrms-table-row-clickable' : ''}
                    onClick={() => onRowClick && onRowClick(row, rowIndex)}
                  >
                    {columns.map((col, colIndex) => {
                      const cellValue = row[col.key];
                      return (
                        <td
                          key={col.key || colIndex}
                          style={{
                            width: col.width || 'auto',
                            minWidth: col.minWidth || 'auto',
                            textAlign: col.align || 'left'
                          }}
                        >
                          {col.render ? col.render(row, rowIndex) : cellValue}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pagination Footer */}
      {pagination && (
        <div className="hrms-table-pagination">
          <div className="hrms-table-pagination-info">
            Showing Page <strong>{pagination.currentPage || 1}</strong> of{' '}
            <strong>{pagination.totalPages || 1}</strong>
            {pagination.totalItems ? ` (${pagination.totalItems} total records)` : ''}
          </div>
          <div className="hrms-table-pagination-actions">
            <Button
              variant="secondary"
              size="sm"
              disabled={(pagination.currentPage || 1) <= 1}
              onClick={() =>
                pagination.onPageChange && pagination.onPageChange(pagination.currentPage - 1)
              }
            >
              Previous
            </Button>
            <Button
              variant="secondary"
              size="sm"
              disabled={(pagination.currentPage || 1) >= (pagination.totalPages || 1)}
              onClick={() =>
                pagination.onPageChange && pagination.onPageChange(pagination.currentPage + 1)
              }
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Table;

