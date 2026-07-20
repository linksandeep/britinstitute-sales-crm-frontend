import React, { useState, useEffect, useRef, useCallback, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Loader, Search } from 'lucide-react';
import type { User } from '../types';
import api from '../lib/api';

interface InfiniteScrollUserDropdownProps {
  value: string;
  onChange: (userId: string) => void;
  disabled?: boolean;
  includeUnassign?: boolean;
  className?: string;
  placeholder?: string;
}

const InfiniteScrollUserDropdown: React.FC<InfiniteScrollUserDropdownProps> = ({
  value,
  onChange,
  disabled = false,
  includeUnassign = false,
  className = '',
  placeholder = 'Select a user...'
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [coords, setCoords] = useState<{ top: number; left: number; width: number } | null>(null);
  
  const dropdownRef = useRef<HTMLDivElement>(null);
  const observerTarget = useRef<HTMLDivElement>(null);

  const getSelectedUserName = () => {
    if (!value) return placeholder;
    if (value === 'unassign') return 'Unassign from current user';
    const selectedUser = users.find(u => u._id === value);
    return selectedUser ? `${selectedUser.name} (${selectedUser.role})` : placeholder;
  };

  // CALCULATION LOGIC: This prevents the flickering
  const updateCoords = useCallback(() => {
    if (dropdownRef.current) {
      const rect = dropdownRef.current.getBoundingClientRect();
      setCoords({
        top: rect.bottom + window.scrollY + 5,
        left: rect.left + window.scrollX,
        width: rect.width
      });
    }
  }, []);

  // Use useLayoutEffect to calculate position before paint
  useLayoutEffect(() => {
    if (isOpen) {
      updateCoords();
    }
  }, [isOpen, updateCoords]);

  // Fetch Logic
  const fetchUsers = useCallback(async (page: number, search: string = '') => {
    if (loading) return;
    try {
      if (page === 1) setInitialLoading(true);
      else setLoading(true);

      const params = new URLSearchParams({
        page: page.toString(),
        limit: '15',
        ...(search && { search })
      });

      const response = await api.get(`/users?${params}`);
      const data = response.data;
      if (data.success) {
        const activeUsers = data.data.filter((u: User) => u.isActive);
        setUsers(prev => page === 1 ? activeUsers : [...prev, ...activeUsers]);
        setHasMore(data.pagination.page < data.pagination.totalPages);
        setCurrentPage(page);
      }
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setLoading(false);
      setInitialLoading(false);
    }
  }, [loading]);

  useEffect(() => {
    if (isOpen) fetchUsers(1, searchQuery);
  }, [isOpen]);

  // Search logic
  useEffect(() => {
    if (!isOpen) return;
    const timer = setTimeout(() => fetchUsers(1, searchQuery), 400);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Infinite Scroll Observer
  useEffect(() => {
    if (!isOpen || !hasMore || loading) return;
    const observer = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting) fetchUsers(currentPage + 1, searchQuery);
    }, { threshold: 0.1 });

    if (observerTarget.current) observer.observe(observerTarget.current);
    return () => observer.disconnect();
  }, [isOpen, hasMore, loading, currentPage, searchQuery]);

  // Close and Scroll Listeners
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    window.addEventListener('scroll', updateCoords, true);
    window.addEventListener('resize', updateCoords);
    document.addEventListener('mousedown', handler);
    return () => {
      window.removeEventListener('scroll', updateCoords, true);
      window.removeEventListener('resize', updateCoords);
      document.removeEventListener('mousedown', handler);
    };
  }, [isOpen, updateCoords]);

  const handleSelect = (userId: string) => {
    onChange(userId);
    setIsOpen(false);
    setSearchQuery('');
  };

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`w-full px-4 py-2 text-left bg-white border border-gray-300 rounded-lg shadow-sm flex items-center justify-between ${disabled ? 'bg-gray-100 cursor-not-allowed' : 'hover:border-gray-400'}`}
      >
        <span className={`truncate ${value ? 'text-gray-900' : 'text-gray-500'}`}>
          {getSelectedUserName()}
        </span>
        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && createPortal(
        <div 
          className="bg-white border border-gray-300 rounded-lg shadow-2xl overflow-hidden"
          style={{
            position: 'absolute', // Absolute relative to portal root
            zIndex: 9999,
            top: coords?.top || 0,
            left: coords?.left || 0,
            width: coords?.width || 0,
            visibility: coords ? 'visible' : 'hidden' // PREVENTS FLASHING
          }}
        >
          <div className="p-2 border-b border-gray-200 bg-gray-50">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                autoFocus
                type="text"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 outline-none"
              />
            </div>
          </div>

          <div className="overflow-y-auto max-h-60 custom-scrollbar">
            {initialLoading ? (
              <div className="p-10 text-center"><Loader className="w-6 h-6 animate-spin mx-auto text-blue-500" /></div>
            ) : (
              <div className="py-1">
                <button type="button" onClick={() => handleSelect('')} className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100">No change</button>
                {includeUnassign && <button type="button" onClick={() => handleSelect('unassign')} className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-gray-100 font-medium">🔄 Unassign</button>}
                
                <div className="h-px bg-gray-100 my-1" />
                
                {users.map(u => (
                  <button type="button" key={u._id} onClick={() => handleSelect(u._id)} className={`w-full px-4 py-2 text-left hover:bg-blue-50 text-sm ${value === u._id ? 'bg-blue-50 border-l-4 border-blue-500' : ''}`}>
                    <div className="font-medium text-gray-900">{u.name} <span className="text-xs text-gray-400 font-normal">({u.role})</span></div>
                    <div className="text-xs text-gray-500">{u.email}</div>
                  </button>
                ))}

                {loading && <div className="p-2 text-center"><Loader className="w-4 h-4 animate-spin mx-auto text-blue-500" /></div>}
                {hasMore && <div ref={observerTarget} className="h-2" />}
              </div>
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default InfiniteScrollUserDropdown;
