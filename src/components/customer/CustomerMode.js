import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import CustomerLogin from './CustomerLogin';
import CustomerDashboard from './CustomerDashboard';

const CustomerMode = () => {
    return (
        <Routes>
            <Route path="login" element={<CustomerLogin />} />
            <Route path="dashboard" element={<CustomerDashboard />} />
            <Route path="/" element={<Navigate to="login" replace />} />
        </Routes>
    );
};

export default CustomerMode;
