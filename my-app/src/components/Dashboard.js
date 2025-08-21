import React, { useEffect, useState } from "react";
import { getAllFeedback, testBackendConnection } from "../utils/api";
import { Link } from "react-router-dom";
import { logout } from "../utils/auth";
import { useNavigate } from "react-router-dom";
import { PieChart, Pie, Cell, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, LineChart, Line } from "recharts";
import { FEEDBACK_STATUS } from "../utils/constants";
import './Dashboard.css';
import { toast } from 'react-toastify';

const COLORS = ["#FF6B6B", "#4ECDC4", "#45B7D1", "#96CEB4", "#FFEAA7"];

export default function Dashboard() {
  const [feedbackData, setFeedbackData] = useState([]);
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    approved: 0,
    rejected: 0,
    recentActivity: []
  });
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      // Test backend connection first
      const isConnected = await testBackendConnection();
      if (!isConnected) {
        toast.warning('Backend connection issues detected. Please check your connection.');
      }
      
      const data = await getAllFeedback();
      setFeedbackData(data);
      
      // Calculate statistics
      const counts = {};
      Object.values(FEEDBACK_STATUS).forEach(s => counts[s] = 0);
      data.forEach(f => counts[f.status] = (counts[f.status] || 0) + 1);
      
      // Get recent activity (last 5 feedback)
      const recentActivity = data
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .slice(0, 5);

      setStats({
        total: data.length,
        pending: counts.PENDING || 0,
        approved: counts.APPROVED || 0,
        rejected: counts.REJECTED || 0,
        recentActivity
      });
    } catch (error) {
      console.error("Error loading dashboard data:", error);
      
      if (error.status === 500) {
        toast.error('Backend server error (500). Please check backend logs and try again.');
        console.error('Backend 500 error details:', error);
        
        // Try to get more details about the error
        if (error.body) {
          try {
            const errorDetails = JSON.parse(error.body);
            console.error('Backend error details:', errorDetails);
            toast.error(`Backend error: ${errorDetails.error || 'Unknown error'}`);
          } catch (parseError) {
            console.error('Could not parse error response:', error.body);
          }
        }
      } else if (error.status === 403) {
        toast.error('Access denied (403). Please check your admin permissions or log in again.');
      } else if (error.status === 401) {
        toast.error('Session expired. Please log in again.');
        navigate('/login');
      } else {
        toast.error(`Failed to load dashboard data: ${error.message}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'APPROVED': return '#4ECDC4';
      case 'PENDING': return '#FFEAA7';
      case 'REJECTED': return '#FF6B6B';
      default: return '#45B7D1';
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const chartData = Object.keys(FEEDBACK_STATUS).map(status => ({
    name: status,
    value: stats[status.toLowerCase()] || 0
  }));

  // Category distribution data
  const categoryCounts = feedbackData.reduce((acc, f) => {
    const key = (f.category && f.category.name) ? f.category.name : 'Uncategorized';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  const categoryData = Object.keys(categoryCounts).map(name => ({ name, value: categoryCounts[name] }));

  const monthlyData = [
    { month: 'Jan', feedback: 12, resolved: 10 },
    { month: 'Feb', feedback: 19, resolved: 15 },
    { month: 'Mar', feedback: 15, resolved: 12 },
    { month: 'Apr', feedback: 22, resolved: 18 },
    { month: 'May', feedback: 18, resolved: 16 },
    { month: 'Jun', feedback: 25, resolved: 20 }
  ];

  if (loading) {
    return (
      <div className="dashboard-container">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-container admin-dashboard">
      <div className="dashboard-header">
        <div className="header-content">
          <h1>Admin Dashboard</h1>
          <p>Welcome back! Here's what's happening with your feedback system.</p>
        </div>
        <button onClick={handleLogout} className="logout-button">
          Logout
        </button>
      </div>

      <div className="dashboard-content">
        {/* Statistics Cards */}
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon">📊</div>
            <div className="stat-content">
              <h3>{stats.total}</h3>
              <p>Total Feedback</p>
            </div>
          </div>
          
          <div className="stat-card">
            <div className="stat-icon">⏳</div>
            <div className="stat-content">
              <h3>{stats.pending}</h3>
              <p>Pending Review</p>
            </div>
          </div>
          
          <div className="stat-card">
            <div className="stat-icon">✅</div>
            <div className="stat-content">
              <h3>{stats.approved}</h3>
              <p>Approved</p>
            </div>
          </div>
          
          <div className="stat-card">
            <div className="stat-icon">❌</div>
            <div className="stat-content">
              <h3>{stats.rejected}</h3>
              <p>Rejected</p>
            </div>
          </div>
        </div>

        {/* Charts Section */}
        <div className="charts-section">
          <div className="chart-card">
            <h3>Feedback Status Distribution</h3>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie 
                  data={chartData} 
                  dataKey="value" 
                  nameKey="name" 
                  cx="50%" 
                  cy="50%" 
                  outerRadius={80}
                  label={({ name, value }) => `${name}: ${value}`}
                >
                  {chartData.map((entry, index) => (
                    <Cell key={index} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="chart-card">
            <h3>Monthly Feedback Trends</h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="feedback" stroke="#667eea" strokeWidth={3} />
                <Line type="monotone" dataKey="resolved" stroke="#764ba2" strokeWidth={3} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="chart-card">
            <h3>Feedback by Category</h3>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={categoryData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  label={({ name, value }) => `${name}: ${value}`}
                >
                  {categoryData.map((entry, index) => (
                    <Cell key={index} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="quick-actions-section">
          <h3>Quick Actions</h3>
          <div className="actions-grid">
            <Link to="/admin" className="action-card">
              <div className="action-icon">📋</div>
              <h4>Manage Feedback</h4>
              <p>Review and respond to feedback</p>
            </Link>
            
            <Link to="/" className="action-card">
              <div className="action-icon">📝</div>
              <h4>Submit Feedback</h4>
              <p>Create new feedback entry</p>
            </Link>
            
            <div className="action-card">
              <div className="action-icon">📊</div>
              <h4>Generate Report</h4>
              <p>Export feedback analytics</p>
            </div>
            
            <div className="action-card">
              <div className="action-icon">⚙️</div>
              <h4>Settings</h4>
              <p>Configure system preferences</p>
            </div>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="recent-activity-section">
          <h3>Recent Activity</h3>
          <div className="activity-list">
            {stats.recentActivity.length > 0 ? (
              stats.recentActivity.map((feedback, index) => (
                <div key={index} className="activity-item">
                  <div className="activity-icon">
                    {feedback.status === 'APPROVED' ? '✅' : 
                     feedback.status === 'REJECTED' ? '❌' : '⏳'}
                  </div>
                  <div className="activity-content">
                    <h4>Feedback #{feedback.id}</h4>
                    <p>{feedback.comment.substring(0, 50)}...</p>
                    <span className="activity-meta">
                      {formatDate(feedback.createdAt)} • 
                      <span 
                        className="status-badge" 
                        style={{ backgroundColor: getStatusColor(feedback.status) }}
                      >
                        {feedback.status}
                      </span>
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div className="no-activity">
                <p>No recent activity</p>
              </div>
            )}
          </div>
        </div>

        {/* System Health */}
        <div className="system-health-section">
          <h3>System Health</h3>
          <div className="health-grid">
            <div className="health-card">
              <div className="health-indicator online"></div>
              <div className="health-content">
                <h4>Database</h4>
                <p>Connected</p>
              </div>
            </div>
            
            <div className="health-card">
              <div className="health-indicator online"></div>
              <div className="health-content">
                <h4>API Server</h4>
                <p>Running</p>
              </div>
            </div>
            
            <div className="health-card">
              <div className="health-indicator online"></div>
              <div className="health-content">
                <h4>Frontend</h4>
                <p>Active</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
