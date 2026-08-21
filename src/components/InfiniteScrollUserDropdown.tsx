import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ChevronDown, Loader } from 'lucide-react';
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
  
  const dropdownRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const observerTarget = useRef<HTMLDivElement>(null);

  // Get selected user display name
  const getSelectedUserName = () => {
    if (!value) return placeholder;
    if (value === 'unassign') return '🔄 Unassign from current user';
    const selectedUser = users.find(u => u._id === value);
    return selectedUser ? `${selectedUser.name} (${selectedUser.role})` : placeholder;
  };

  // Fetch users from API
  const fetchUsers = useCallback(async (page: number, search: string = '') => {
    if (loading) return;
    
    try {
      if (page === 1) {
        setInitialLoading(true);
      } else {
        setLoading(true);
      }

      const params = new URLSearchParams({
        page: page.toString(),
        limit: '10',
        ...(search && { search })
      });

      const response = await api.get(`/users?${params}`);
      const data = response.data;

      if (data.success && data.data) {
        const activeUsers = data.data.filter((u: User) => u.isActive);
        
        if (page === 1) {
          setUsers(activeUsers);
        } else {
          setUsers(prev => [...prev, ...activeUsers]);
        }

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

  // Initial load
  useEffect(() => {
    if (isOpen && users.length === 0) {
      fetchUsers(1, searchQuery);
    }
  }, [isOpen]);

  // Search handler with debounce
  useEffect(() => {
    if (!isOpen) return;

    const timeoutId = setTimeout(() => {
      setUsers([]);
      setCurrentPage(1);
      setHasMore(true);
      fetchUsers(1, searchQuery);
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  // Intersection Observer for infinite scroll
  useEffect(() => {
    if (!isOpen || !hasMore || loading) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loading) {
          fetchUsers(currentPage + 1, searchQuery);
        }
      },
      { threshold: 0.1 }
    );

    const currentTarget = observerTarget.current;
    if (currentTarget) {
      observer.observe(currentTarget);
    }

    return () => {
      if (currentTarget) {
        observer.unobserve(currentTarget);
      }
    };
  }, [isOpen, hasMore, loading, currentPage, searchQuery, fetchUsers]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleScroll = () => {
      if (isOpen) {
        // Force re-render to update position
        setIsOpen(false);
        setTimeout(() => setIsOpen(true), 0);
      }
    };

    const handleResize = () => {
      if (isOpen) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      window.addEventListener('scroll', handleScroll, true);
      window.addEventListener('resize', handleResize);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('scroll', handleScroll, true);
      window.removeEventListener('resize', handleResize);
    };
  }, [isOpen]);

  const handleSelect = (userId: string) => {
    onChange(userId);
    setIsOpen(false);
    setSearchQuery('');
  };

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      {/* Dropdown Button */}
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`w-full px-4 py-2 text-left bg-white border border-gray-300 rounded-lg shadow-sm 
          focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
          ${disabled ? 'bg-gray-100 cursor-not-allowed' : 'cursor-pointer hover:border-gray-400'}
          flex items-center justify-between`}
      >
        <span className={value ? 'text-gray-900' : 'text-gray-500'}>
          {getSelectedUserName()}
        </span>
        <ChevronDown 
          className={`w-5 h-5 text-gray-400 transition-transform ${isOpen ? 'transform rotate-180' : ''}`} 
        />
      </button>

      {/* Dropdown Menu - Fixed positioning to prevent hiding */}
      {isOpen && (
        <div 
          className="fixed bg-white border border-gray-300 rounded-lg shadow-2xl max-h-80 overflow-hidden"
          style={{
            zIndex: 9999,
            width: dropdownRef.current?.offsetWidth || 'auto',
            top: dropdownRef.current ? 
              dropdownRef.current.getBoundingClientRect().bottom + window.scrollY + 4 : 0,
            left: dropdownRef.current ? 
              dropdownRef.current.getBoundingClientRect().left + window.scrollX : 0,
          }}
        >
          {/* Search Input */}
          <div className="p-2 border-b border-gray-200 sticky top-0 bg-white z-10">
            <input
              type="text"
              placeholder="Search users..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              onClick={(e) => e.stopPropagation()}
            />
          </div>

          {/* User List */}
          <div 
            ref={listRef}
            className="overflow-y-auto max-h-64"
          >
            {initialLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader className="w-6 h-6 animate-spin text-blue-600" />
                <span className="ml-2 text-sm text-gray-600">Loading users...</span>
              </div>
            ) : (
              <>
                {/* No change option */}
                <button
                  type="button"
                  onClick={() => handleSelect('')}
                  className={`w-full px-4 py-2 text-left hover:bg-gray-100 transition-colors
                    ${value === '' ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700'}`}
                >
                  No change to assignment
                </button>

                {/* Unassign option */}
                {includeUnassign && (
                  <button
                    type="button"
                    onClick={() => handleSelect('unassign')}
                    className={`w-full px-4 py-2 text-left hover:bg-gray-100 transition-colors
                      ${value === 'unassign' ? 'bg-blue-50 text-blue-700 font-medium' : 'text-red-600'}`}
                  >
                    🔄 Unassign from current user
                  </button>
                )}

                {/* Divider */}
                {users.length > 0 && (
                  <div className="border-t border-gray-200 my-1">
                    <div className="px-4 py-1 text-xs font-semibold text-gray-500 bg-gray-50">
                      Assign to User
                    </div>
                  </div>
                )}

                {/* User options */}
                {users.map((user) => (
                  <button
                    key={user._id}
                    type="button"
                    onClick={() => handleSelect(user._id)}
                    className={`w-full px-4 py-2 text-left hover:bg-gray-100 transition-colors
                      ${value === user._id ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700'}`}
                  >
                    <div className="flex items-center justify-between">
                      <span>{user.name}</span>
                      <span className="text-xs text-gray-500 ml-2">({user.role})</span>
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">{user.email}</div>
                  </button>
                ))}

                {/* Loading indicator for pagination */}
                {loading && !initialLoading && (
                  <div className="flex items-center justify-center py-4">
                    <Loader className="w-5 h-5 animate-spin text-blue-600" />
                    <span className="ml-2 text-sm text-gray-600">Loading more...</span>
                  </div>
                )}

                {/* Intersection observer target */}
                {hasMore && !loading && (
                  <div ref={observerTarget} className="h-4" />
                )}

                {/* No more users message */}
                {!hasMore && users.length > 0 && (
                  <div className="px-4 py-2 text-sm text-gray-500 text-center bg-gray-50">
                    No more users
                  </div>
                )}

                {/* No results */}
                {!initialLoading && users.length === 0 && (
                  <div className="px-4 py-8 text-sm text-gray-500 text-center">
                    {searchQuery ? 'No users found' : 'No active users available'}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default InfiniteScrollUserDropdown;
