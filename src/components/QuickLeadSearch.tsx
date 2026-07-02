import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, Mail, Phone, Search, UserRound } from 'lucide-react';
import { leadApi } from '../lib/api';
import type { Lead } from '../types';
import { useDebouncedValue } from '../hooks/useDebouncedValue';

interface QuickLeadSearchProps {
  className?: string;
  placeholder?: string;
  onSelectLead?: (lead: Lead) => void;
}

const QuickLeadSearch: React.FC<QuickLeadSearchProps> = ({
  className = '',
  placeholder = 'Search name, email, or phone',
  onSelectLead
}) => {
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Lead[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const debouncedQuery = useDebouncedValue(query.trim(), 280);

  const canSearch = debouncedQuery.length >= 2;

  useEffect(() => {
    let isActive = true;

    const runSearch = async () => {
      if (!canSearch) {
        setResults([]);
        setIsOpen(false);
        return;
      }

      setIsLoading(true);
      const response = await leadApi.getLeadsBySearch(debouncedQuery);

      if (!isActive) return;

      if (response.success && response.data) {
        setResults(response.data.slice(0, 8));
        setIsOpen(true);
      } else {
        setResults([]);
        setIsOpen(true);
      }

      setIsLoading(false);
    };

    runSearch();

    return () => {
      isActive = false;
    };
  }, [canSearch, debouncedQuery]);

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, []);

  const statusText = useMemo(() => {
    if (isLoading) return 'Searching leads';
    if (!canSearch) return 'Type at least 2 characters';
    if (results.length === 0) return 'No matching leads';
    return `${results.length} result${results.length === 1 ? '' : 's'}`;
  }, [canSearch, isLoading, results.length]);

  const selectLead = (lead: Lead) => {
    setQuery('');
    setIsOpen(false);

    if (onSelectLead) {
      onSelectLead(lead);
      return;
    }

    navigate(`/leads/${lead._id}`);
  };

  return (
    <div ref={containerRef} className={`quick-search ${className}`}>
      <div className="quick-search__field">
        <Search className="quick-search__icon" />
        <input
          type="search"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setIsOpen(true);
          }}
          onFocus={() => {
            if (canSearch) setIsOpen(true);
          }}
          placeholder={placeholder}
          className="quick-search__input"
          aria-label="Quick lead search"
        />
        {isLoading && <Loader2 className="quick-search__loader" />}
      </div>

      {isOpen && (
        <div className="quick-search__panel">
          <div className="quick-search__meta">{statusText}</div>

          {results.map((lead) => (
            <button
              key={lead._id}
              type="button"
              className="quick-search__result"
              onClick={() => selectLead(lead)}
            >
              <span className="quick-search__avatar">
                <UserRound className="h-4 w-4" />
              </span>
              <span className="quick-search__content">
                <span className="quick-search__name">{lead.name}</span>
                <span className="quick-search__detail">
                  <Mail className="h-3.5 w-3.5" />
                  {lead.email || 'No email'}
                </span>
                <span className="quick-search__detail">
                  <Phone className="h-3.5 w-3.5" />
                  {lead.phone || 'No phone'}
                </span>
              </span>
              <span className="quick-search__status">{lead.status}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default QuickLeadSearch;
