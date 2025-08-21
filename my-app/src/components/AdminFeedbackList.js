import React, { useEffect, useMemo, useState } from 'react';
import { searchAdminFeedback, updateFeedbackStatus, deleteFeedback, listAllCategories, updateFeedbackCategory, testBackendConnection, testAdminEndpoints, testDatabaseHealth } from '../utils/api';
import { getToken, getUserRole, getUserId, getUserEmail } from '../utils/auth';
import { FEEDBACK_STATUS } from '../utils/constants';
import { toast } from 'react-toastify';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import './Feedback.css';

const formatDate = (dateStr) => {
  const date = new Date(dateStr);
  return isNaN(date)
    ? ''
    : `${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}/${date.getFullYear()}`;
};

const STATE_KEY = 'adminFeedbackState';

export default function AdminFeedbackList() {
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [data, setData] = useState({ content: [], totalElements: 0, totalPages: 0, number: 0, size: 10 });
  const [modal, setModal] = useState({ open: false, action: null, id: null });
  const [categories, setCategories] = useState([]);

  // Initialize from URL or localStorage
  const defaultState = (() => {
    const fromUrl = {
      page: Number(searchParams.get('page') || 0),
      size: Number(searchParams.get('size') || 10),
      sortBy: searchParams.get('sortBy') || 'createdAt',
      sortOrder: searchParams.get('sortOrder') || 'desc',
      filters: {
        name: searchParams.get('name') || '',
        email: searchParams.get('email') || '',
        status: searchParams.get('status') || '',
        rating: searchParams.get('rating') || '',
        category: searchParams.get('category') || ''
      }
    };
    if (location.search) return fromUrl;
    const saved = localStorage.getItem(STATE_KEY);
    if (saved) {
      try { return JSON.parse(saved); } catch {}
    }
    return fromUrl;
  })();

  const [filters, setFilters] = useState(defaultState.filters);
  const [page, setPage] = useState(defaultState.page);
  const [size, setSize] = useState(defaultState.size);
  const [sortBy, setSortBy] = useState(defaultState.sortBy);
  const [sortOrder, setSortOrder] = useState(defaultState.sortOrder);
  const navigate = useNavigate();

  const syncUrlAndStorage = () => {
    const params = new URLSearchParams();
    params.set('page', String(page));
    params.set('size', String(size));
    params.set('sortBy', sortBy);
    params.set('sortOrder', sortOrder);
    if (filters.name) params.set('name', filters.name); else params.delete('name');
    if (filters.email) params.set('email', filters.email); else params.delete('email');
    if (filters.status) params.set('status', filters.status); else params.delete('status');
    if (filters.rating) params.set('rating', String(filters.rating)); else params.delete('rating');
    if (filters.category) params.set('category', String(filters.category)); else params.delete('category');
    setSearchParams(params);
    localStorage.setItem(STATE_KEY, JSON.stringify({ page, size, sortBy, sortOrder, filters }));
  };

  const fetchCategories = async () => {
    try {
      console.log('Fetching categories...');
      const all = await listAllCategories();
      console.log('Categories loaded:', all);
      setCategories(all);
    } catch (e) {
      console.error('Category fetch error:', e);
      console.error('Error status:', e.status);
      console.error('Error message:', e.message);
      toast.error(`Failed to load categories: ${e.message}`);
    }
  };

  const fetchData = async () => {
    try {
      console.log('Fetching feedback with params:', { page, size, sortBy, sortOrder, ...filters });
      
      // Test backend connection first
      const isConnected = await testBackendConnection();
      if (!isConnected) {
        toast.warning('Backend connection issues detected. Please check your connection.');
      }
      
      const pageData = await searchAdminFeedback({ page, size, sortBy, sortOrder, ...filters });
      console.log('Feedback loaded:', pageData);
      setData(pageData);
    } catch (err) {
      console.error('Feedback fetch error:', err);
      console.error('Error status:', err.status);
      console.error('Error message:', err.message);
      
      if (err.status === 500) {
        toast.error('Backend server error (500). Please check backend logs and try again.');
        console.error('Backend 500 error details:', err);
        
        // Try to get more details about the error
        if (err.body) {
          try {
            const errorDetails = JSON.parse(err.body);
            console.error('Backend error details:', errorDetails);
            toast.error(`Backend error: ${errorDetails.error || 'Unknown error'}`);
          } catch (parseError) {
            console.error('Could not parse error response:', err.body);
          }
        }
      } else if (err.status === 403) {
        toast.error('Access denied (403). Please check your admin permissions or log in again.');
        // Optionally redirect to login
        // navigate('/login');
      } else if (err.status === 401) {
        toast.error('Authentication failed. Please log in again.');
        navigate('/login');
      } else {
        toast.error(`Failed to load feedback: ${err.message}`);
      }
    }
  };

  useEffect(() => { fetchCategories(); }, []);
  useEffect(() => { fetchData(); }, [page, size, sortBy, sortOrder, filters]);
  useEffect(() => { syncUrlAndStorage(); }, [page, size, sortBy, sortOrder, filters]);

  const onFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => ({ ...prev, [name]: value }));
  };

  const applyFilters = () => {
    setPage(0);
  };

  const resetFilters = () => {
    setFilters({ name: '', email: '', status: '', rating: '', category: '' });
    setPage(0);
  };

  const openModal = (id, action) => setModal({ open: true, action, id });
  const closeModal = () => setModal({ open: false, action: null, id: null });

  const confirmAction = async () => {
    const { action, id } = modal;
    try {
      if (action === 'approve' || action === 'reject') {
        const status = action === 'approve' ? FEEDBACK_STATUS.APPROVED : FEEDBACK_STATUS.REJECTED;
        await updateFeedbackStatus(id, status);
        toast.success(`Feedback ${status}`);
        setData(prev => ({ ...prev, content: prev.content.map(fb => fb.id === id ? { ...fb, status } : fb) }));
      } else if (action === 'delete') {
        await deleteFeedback(id);
        toast.success('Feedback deleted');
        setData(prev => ({ ...prev, content: prev.content.filter(fb => fb.id !== id), totalElements: Math.max(prev.totalElements - 1, 0) }));
      }
    } catch (err) {
      toast.error(err.message || 'Action failed');
    } finally {
      closeModal();
    }
  };

  const toggleSort = (field) => {
    if (sortBy === field) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
  };

  const pages = useMemo(() => Array.from({ length: data.totalPages || 0 }, (_, i) => i), [data.totalPages]);

  const onAssignCategory = async (id, categoryId) => {
    try {
      await updateFeedbackCategory(id, categoryId || '');
      const category = categories.find(c => String(c.id) === String(categoryId));
      setData(prev => ({ ...prev, content: prev.content.map(fb => fb.id === id ? { ...fb, category: category || null } : fb) }));
      toast.success('Category updated');
    } catch (e) {
      toast.error('Failed to update category');
    }
  };

  return (
    <div className="admin-feedback-wrapper">
      <h2>Manage Feedback</h2>

      {/* Debug Section - Remove this in production */}
      <div style={{ 
        background: '#f0f0f0', 
        padding: '10px', 
        margin: '10px 0', 
        border: '1px solid #ccc',
        fontSize: '12px'
      }}>
        <strong>Debug Info:</strong>
        <div>Token: {getToken() ? 'Present' : 'Missing'}</div>
        <div>Role: {getUserRole() || 'None'}</div>
        <div>User ID: {getUserId() || 'None'}</div>
        <div>User Email: {getUserEmail() || 'None'}</div>
        <div style={{ display: 'flex', gap: '5px', marginTop: '5px' }}>
          <button 
            onClick={async () => {
              try {
                const result = await testBackendConnection();
                console.log('Connection test result:', result);
                toast.info(`Backend connection: ${result ? 'OK' : 'Failed'}`);
              } catch (error) {
                console.error('Connection test error:', error);
                toast.error('Connection test failed');
              }
            }}
            style={{ padding: '2px 8px' }}
          >
            Test Connection
          </button>
          <button 
            onClick={async () => {
              try {
                await testAdminEndpoints();
                toast.info('Admin endpoints test completed. Check console for details.');
              } catch (error) {
                console.error('Admin endpoints test error:', error);
                toast.error('Admin endpoints test failed');
              }
            }}
            style={{ padding: '2px 8px' }}
          >
            Test Admin Endpoints
          </button>
          <button 
            onClick={async () => {
              try {
                const result = await testDatabaseHealth();
                console.log('Database health test result:', result);
                toast.info(`Database health: ${result ? 'OK' : 'Issues detected'}`);
              } catch (error) {
                console.error('Database health test error:', error);
                toast.error('Database health test failed');
              }
            }}
            style={{ padding: '2px 8px' }}
          >
            Test Database
          </button>
        </div>
      </div>

      <div className="filters" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
        <input name="name" value={filters.name} onChange={onFilterChange} placeholder="Name" />
        <input name="email" value={filters.email} onChange={onFilterChange} placeholder="Email" />
        <select name="status" value={filters.status} onChange={onFilterChange}>
          <option value="">All Status</option>
          {Object.keys(FEEDBACK_STATUS).map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select name="rating" value={filters.rating} onChange={onFilterChange}>
          <option value="">All Ratings</option>
          {[1,2,3,4,5].map(r => <option key={r} value={r}>{r}</option>)}
        </select>
        <select name="category" value={filters.category} onChange={onFilterChange}>
          <option value="">All Categories</option>
          {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={applyFilters}>Apply</button>
          <button onClick={resetFilters}>Reset</button>
        </div>
      </div>

      <div className="table-container" style={{ overflowX: 'auto' }}>
        <table className="styled-table">
          <thead>
            <tr>
              <th onClick={() => toggleSort('submitterName')}>Name</th>
              <th onClick={() => toggleSort('submitterEmail')}>Email</th>
              <th onClick={() => toggleSort('productId')}>Product</th>
              <th onClick={() => toggleSort('rating')}>Rating</th>
              <th>Comment</th>
              <th onClick={() => toggleSort('status')}>Status</th>
              <th>Category</th>
              <th onClick={() => toggleSort('createdAt')}>Date</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {data.content.map(fb => (
              <tr key={fb.id}>
                <td>{fb.submitterName || ''}</td>
                <td>{fb.submitterEmail || ''}</td>
                <td>{fb.productId}</td>
                <td>{fb.rating}</td>
                <td>{fb.comment}</td>
                <td>
                  <span className={`status-badge ${fb.status?.toLowerCase?.() || ''}`}>
                    {fb.status}
                  </span>
                </td>
                <td>
                  <select value={fb.category?.id || ''} onChange={(e) => onAssignCategory(fb.id, e.target.value)}>
                    <option value="">Uncategorized</option>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </td>
                <td>{formatDate(fb.createdAt)}</td>
                <td>
                  {fb.status === FEEDBACK_STATUS.PENDING && (
                    <>
                      <button onClick={() => setModal({ open: true, action: 'approve', id: fb.id })}>Approve</button>
                      <button onClick={() => setModal({ open: true, action: 'reject', id: fb.id })}>Reject</button>
                    </>
                  )}
                  <button onClick={() => setModal({ open: true, action: 'delete', id: fb.id })}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="pagination" style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12 }}>
        <button disabled={page <= 0} onClick={() => setPage(p => Math.max(p - 1, 0))}>Prev</button>
        {pages.map(p => (
          <button key={p} className={p === page ? 'active' : ''} onClick={() => setPage(p)}>{p + 1}</button>
        ))}
        <button disabled={page >= (data.totalPages - 1)} onClick={() => setPage(p => Math.min(p + 1, (data.totalPages - 1)))}>Next</button>
        <select value={size} onChange={(e) => { setSize(Number(e.target.value)); setPage(0); }}>
          {[10,20,50].map(s => <option key={s} value={s}>{s} / page</option>)}
        </select>
      </div>

      {modal.open && (
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <div className="modal">
            <h3>Confirm Action</h3>
            <p>Are you sure you want to <b>{modal.action}</b> this feedback?</p>
            <div className="modal-actions">
              <button onClick={confirmAction}>Confirm</button>
              <button onClick={closeModal}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
