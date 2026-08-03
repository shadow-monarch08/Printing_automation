import React, { useState } from 'react';
import { Button } from './Button';
import { CustomSelect } from './CustomSelect';
import { soundFx } from '../../utils/sound';

export interface PaperTableProps<T = any> {
  children?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;

  // Native Client-Side Data Pagination Mode
  data?: T[];
  renderData?: (paginatedData: T[]) => React.ReactNode;

  // Pagination Configuration & Controlled State
  pagination?: boolean;
  page?: number;
  defaultPage?: number;
  totalPages?: number;
  totalRecords?: number;
  itemsPerPage?: number;
  itemsPerPageOptions?: number[];

  // Callbacks
  onPageChange?: (page: number) => void;
  onItemsPerPageChange?: (itemsPerPage: number) => void;

  // Display Customizations
  showRecordCount?: boolean;
  showPageSizeSelector?: boolean;
}

export function PaperTable<T = any>({
  children,
  className = '',
  style,

  data,
  renderData,

  pagination = true,
  page: controlledPage,
  defaultPage = 1,
  totalPages: controlledTotalPages,
  totalRecords: controlledTotalRecords,
  itemsPerPage: controlledItemsPerPage = 10,
  itemsPerPageOptions = [5, 10, 20, 50],

  onPageChange,
  onItemsPerPageChange,

  showRecordCount = true,
  showPageSizeSelector = false,
}: PaperTableProps<T>) {
  // Internal State for Native Uncontrolled Mode
  const [internalPage, setInternalPage] = useState(defaultPage);
  const [internalItemsPerPage, setInternalItemsPerPage] = useState(controlledItemsPerPage);

  const isClientSide = Array.isArray(data);
  const itemsPerPage = isClientSide ? internalItemsPerPage : controlledItemsPerPage;

  // Calculate total pages & record bounds
  let totalRecords = 0;
  let totalPages = 1;

  if (isClientSide && data) {
    totalRecords = data.length;
    totalPages = Math.max(1, Math.ceil(totalRecords / itemsPerPage));
  } else {
    totalRecords = controlledTotalRecords ?? 0;
    totalPages = controlledTotalPages ?? 1;
  }

  // Active page resolution
  const currentPage = controlledPage !== undefined ? controlledPage : internalPage;

  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > totalPages) return;
    soundFx.playClick();

    if (controlledPage === undefined) {
      setInternalPage(newPage);
    }
    onPageChange?.(newPage);
  };

  const handleItemsPerPageChange = (newSize: number) => {
    soundFx.playClick();
    if (isClientSide) {
      setInternalItemsPerPage(newSize);
      setInternalPage(1);
    }
    onItemsPerPageChange?.(newSize);
    onPageChange?.(1);
  };

  // Slice data if in native client-side mode
  const paginatedData = isClientSide && data
    ? data.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
    : [];

  const startRecord = totalRecords > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0;
  const endRecord = totalRecords > 0 ? Math.min(currentPage * itemsPerPage, totalRecords) : 0;

  // Decide if pagination bar should render (only if enabled and totalPages > 1 or showPageSizeSelector is set)
  const shouldShowPagination = pagination && (totalPages > 1 || totalRecords > itemsPerPage || showPageSizeSelector);

  return (
    <div
      className={`paper-sheet-container paper-sheet-table table-wrapper ${className}`}
      style={{
        position: 'relative',
        backgroundColor: 'var(--bg-paper)',
        color: 'var(--text-primary)',
        boxShadow: 'var(--shadow-paper)',
        borderTop: '2px dashed var(--border-default)',
        borderRadius: '0 0 var(--radius-sm) var(--radius-sm)',
        margin: '24px 0',
        overflow: 'hidden',
        ...style,
      }}
    >
      {/* Tractor Feed Left & Right Perforation Hole Accents */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '12px',
          height: '12px',
          transform: 'translate(-50%, -50%)',
          borderRadius: '50%',
          backgroundColor: 'var(--bg-primary)',
          border: '1px solid var(--border-default)',
          pointerEvents: 'none',
          zIndex: 5,
        }}
      />
      <div
        style={{
          position: 'absolute',
          top: 0,
          right: 0,
          width: '12px',
          height: '12px',
          transform: 'translate(50%, -50%)',
          borderRadius: '50%',
          backgroundColor: 'var(--bg-primary)',
          border: '1px solid var(--border-default)',
          pointerEvents: 'none',
          zIndex: 5,
        }}
      />

      {/* Table Content Area */}
      <div style={{ overflowX: 'auto', padding: '16px' }}>
        {renderData ? renderData(paginatedData) : children}
      </div>

      {/* Built-in Pagination Control Strip */}
      {shouldShowPagination && (
        <div
          className="paper-table-pagination"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 20px',
            background: 'var(--bg-surface)',
            borderTop: '1px solid var(--border-default)',
            fontFamily: 'var(--font-mono)',
            fontSize: '12px',
            gap: '12px',
            flexWrap: 'wrap',
          }}
        >
          {/* Record Count Stats */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            {showRecordCount && (
              <span style={{ color: 'var(--text-secondary)' }}>
                Showing <strong style={{ color: 'var(--accent-primary)' }}>{startRecord}–{endRecord}</strong> of <strong>{totalRecords}</strong> records
              </span>
            )}

            {showPageSizeSelector && itemsPerPageOptions.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Per page:</span>
                <div style={{ minWidth: '70px' }}>
                  <CustomSelect
                    options={itemsPerPageOptions.map((opt) => ({ label: String(opt), value: String(opt) }))}
                    value={String(itemsPerPage)}
                    onChange={(val) => handleItemsPerPageChange(Number(val))}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Page Indicators & Buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Button
              variant="ghost"
              disabled={currentPage <= 1}
              onClick={() => handlePageChange(currentPage - 1)}
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '11px',
                height: '32px',
                padding: '0 12px',
              }}
            >
              [ ← PREV ]
            </Button>

            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '12px',
                fontWeight: 700,
                color: 'var(--text-primary)',
                padding: '2px 8px',
                background: 'var(--bg-primary)',
                border: '1px solid var(--border-default)',
                borderRadius: 'var(--radius-sm)',
              }}
            >
              PAGE {currentPage} OF {totalPages}
            </span>

            <Button
              variant="ghost"
              disabled={currentPage >= totalPages}
              onClick={() => handlePageChange(currentPage + 1)}
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '11px',
                height: '32px',
                padding: '0 12px',
              }}
            >
              [ NEXT ➔ ]
            </Button>
          </div>
        </div>
      )}

      {/* Bottom Paper Curl Drop-Shadow Accent */}
      <div
        style={{
          height: '4px',
          background: 'linear-gradient(to bottom, transparent, rgba(0,0,0,0.08))',
          pointerEvents: 'none',
        }}
      />
    </div>
  );
}
