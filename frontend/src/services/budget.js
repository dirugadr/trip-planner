import { apiGet, apiPost, apiPut, apiDelete } from './api.js';

// Summary: categories with allocated vs spent, plus totals
export const getBudgetSummary = (tripId) => apiGet(`/trips/${tripId}/budget`);

// Budget categories
export const listBudgetCategories = (tripId) => apiGet(`/budget-categories?trip_id=${tripId}`);
export const createBudgetCategory = (data) => apiPost('/budget-categories', data);
export const updateBudgetCategory = (id, data) => apiPut(`/budget-categories/${id}`, data);
export const deleteBudgetCategory = (id) => apiDelete(`/budget-categories/${id}`);

// Expenses
export const listExpenses = (tripId) => apiGet(`/expenses?trip_id=${tripId}`);
export const createExpense = (data) => apiPost('/expenses', data);
export const updateExpense = (id, data) => apiPut(`/expenses/${id}`, data);
export const deleteExpense = (id) => apiDelete(`/expenses/${id}`);

// Reference data
export const listPaymentMethods = () => apiGet('/payment-methods');
