import { useState, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { useAsync } from '../hooks/useAsync.js';
import { useConfirm } from '../hooks/useConfirm.jsx';
import { getTrip } from '../services/trips.js';
import {
  getBudgetSummary,
  listExpenses,
  listPaymentMethods,
  createBudgetCategory,
  updateBudgetCategory,
  deleteBudgetCategory,
  createExpense,
  updateExpense,
  deleteExpense,
} from '../services/budget.js';
import { formatDate, formatMoney } from '../utils/format.js';
import Spinner from '../components/Spinner.jsx';
import ErrorMessage from '../components/ErrorMessage.jsx';
import Modal from '../components/Modal.jsx';
import BudgetCategoryForm from '../components/BudgetCategoryForm.jsx';
import ExpenseForm from '../components/ExpenseForm.jsx';
import TripTabs from '../components/TripTabs.jsx';

export default function BudgetPage() {
  const { id } = useParams();

  const { data, loading, error, reload } = useAsync(
    () =>
      Promise.all([
        getBudgetSummary(id),
        listExpenses(id),
        listPaymentMethods(),
        getTrip(id),
      ]).then(([budget, expenses, paymentMethods, trip]) => ({
        budget,
        expenses,
        paymentMethods,
        trip,
      })),
    [id]
  );

  const [categoryModal, setCategoryModal] = useState(null); // { category? }
  const [expenseModal, setExpenseModal] = useState(null); // { expense? }
  const [actionError, setActionError] = useState(null);
  const [confirmNode, confirm] = useConfirm();

  const activityOptions = useMemo(() => {
    if (!data?.trip?.days) return [];
    const opts = [];
    for (const day of data.trip.days) {
      for (const act of day.activities || []) {
        opts.push({ id: act.id, label: `Día ${day.day_number} · ${act.title}` });
      }
    }
    return opts;
  }, [data]);

  const run = async (fn) => {
    setActionError(null);
    try {
      await fn();
      reload();
    } catch (err) {
      setActionError(err.message);
    }
  };

  if (loading) return <Spinner />;
  if (error) return <ErrorMessage error={error} onRetry={reload} />;

  const { budget, expenses, paymentMethods, trip } = data;
  const currency = budget.currency_code || 'USD';
  const catById = new Map(budget.categories.map((c) => [c.id, c]));
  const pmById = new Map(paymentMethods.map((m) => [m.id, m]));

  const pct =
    budget.total_budget && budget.total_budget > 0
      ? Math.min(100, Math.round((budget.total_spent / budget.total_budget) * 100))
      : null;

  const handleCategorySubmit = (payload) =>
    run(async () => {
      if (categoryModal.category) {
        await updateBudgetCategory(categoryModal.category.id, payload);
      } else {
        await createBudgetCategory({ trip_id: id, ...payload });
      }
      setCategoryModal(null);
    });

  const handleDeleteCategory = async (category) => {
    const ok = await confirm({
      title: 'Eliminar categoría',
      message: `¿Eliminar la categoría "${category.name}"?`,
    });
    if (!ok) return;
    run(() => deleteBudgetCategory(category.id));
  };

  const handleExpenseSubmit = (payload) =>
    run(async () => {
      if (expenseModal.expense) {
        await updateExpense(expenseModal.expense.id, payload);
      } else {
        await createExpense({ trip_id: id, ...payload });
      }
      setExpenseModal(null);
    });

  const handleDeleteExpense = async (expense) => {
    const ok = await confirm({
      title: 'Eliminar gasto',
      message: `¿Eliminar este gasto de ${formatMoney(expense.amount, expense.currency_code)}?`,
    });
    if (!ok) return;
    run(() => deleteExpense(expense.id));
  };

  return (
    <div>
      <TripTabs tripId={id} />

      {actionError && <ErrorMessage error={actionError} />}

      <div className="card">
        <h1 style={{ marginBottom: '0.2rem' }}>Presupuesto</h1>
        <div className="muted">{trip.name}</div>

        <div className="budget-totals">
          <div>
            <div className="muted">Presupuesto</div>
            <strong>{budget.total_budget != null ? formatMoney(budget.total_budget, currency) : '—'}</strong>
          </div>
          <div>
            <div className="muted">Asignado</div>
            <strong>{formatMoney(budget.total_allocated, currency)}</strong>
          </div>
          <div>
            <div className="muted">Gastado</div>
            <strong>{formatMoney(budget.total_spent, currency)}</strong>
          </div>
          <div>
            <div className="muted">Resto</div>
            <strong className={budget.over_budget ? 'text-over' : undefined}>
              {budget.remaining != null ? formatMoney(budget.remaining, currency) : '—'}
            </strong>
          </div>
        </div>

        {pct != null && (
          <div className="progress" title={`${pct}%`}>
            <div
              className={`progress-bar${budget.over_budget ? ' progress-bar-over' : ''}`}
              style={{ width: `${pct}%` }}
            />
          </div>
        )}
      </div>

      <div className="row-between" style={{ margin: '1.5rem 0 0.75rem' }}>
        <h2 style={{ margin: 0 }}>Categorías</h2>
        <button className="btn btn-sm" onClick={() => setCategoryModal({})}>
          + Categoría
        </button>
      </div>

      {budget.categories.length === 0 ? (
        <div className="empty-state">Creá una categoría para empezar a repartir el presupuesto.</div>
      ) : (
        budget.categories.map((c) => (
          <div className="card" key={c.id}>
            <div className="row-between">
              <div>
                <strong>{c.name}</strong>
                <div className="muted">
                  Gastado {formatMoney(c.spent, currency)}
                  {c.allocated_budget != null && <> / asignado {formatMoney(c.allocated_budget, currency)}</>}
                  {' · '}
                  {c.expense_count} gasto{c.expense_count === 1 ? '' : 's'}
                </div>
                {c.remaining != null && (
                  <div className={c.over_budget ? 'text-over' : 'muted'}>
                    {c.over_budget ? 'Excedido ' : 'Resto '}
                    {formatMoney(Math.abs(c.remaining), currency)}
                  </div>
                )}
              </div>
              <div className="activity-actions">
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => setCategoryModal({ category: c })}
                >
                  Editar
                </button>
                <button className="btn btn-danger btn-sm" onClick={() => handleDeleteCategory(c)}>
                  Eliminar
                </button>
              </div>
            </div>
          </div>
        ))
      )}

      <div className="row-between" style={{ margin: '1.5rem 0 0.75rem' }}>
        <h2 style={{ margin: 0 }}>Gastos</h2>
        <button
          className="btn btn-sm"
          onClick={() => setExpenseModal({})}
          disabled={budget.categories.length === 0}
          title={budget.categories.length === 0 ? 'Creá una categoría primero' : undefined}
        >
          + Gasto
        </button>
      </div>

      {expenses.length === 0 ? (
        <div className="empty-state">Sin gastos registrados.</div>
      ) : (
        <div className="card">
          {expenses.map((e) => (
            <div className="expense-row" key={e.id}>
              <div className="expense-date">{formatDate(e.expense_date)}</div>
              <div className="expense-body">
                <div style={{ fontWeight: 600 }}>{e.description || catById.get(e.category_id)?.name || 'Gasto'}</div>
                <div className="muted">
                  {catById.get(e.category_id)?.name || '—'}
                  {e.payment_method_id && pmById.get(e.payment_method_id) && (
                    <> · {pmById.get(e.payment_method_id).name}</>
                  )}
                </div>
              </div>
              <div className="expense-amount">{formatMoney(e.amount, e.currency_code)}</div>
              <div className="activity-actions">
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => setExpenseModal({ expense: e })}
                >
                  Editar
                </button>
                <button className="btn btn-danger btn-sm" onClick={() => handleDeleteExpense(e)}>
                  Eliminar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {confirmNode}

      {categoryModal && (
        <Modal
          title={categoryModal.category ? 'Editar categoría' : 'Nueva categoría'}
          onClose={() => setCategoryModal(null)}
        >
          <BudgetCategoryForm
            initial={categoryModal.category}
            onSubmit={handleCategorySubmit}
            onCancel={() => setCategoryModal(null)}
          />
        </Modal>
      )}

      {expenseModal && (
        <Modal
          title={expenseModal.expense ? 'Editar gasto' : 'Nuevo gasto'}
          onClose={() => setExpenseModal(null)}
        >
          <ExpenseForm
            initial={expenseModal.expense}
            categories={budget.categories}
            paymentMethods={paymentMethods}
            activityOptions={activityOptions}
            defaultCurrency={currency}
            onSubmit={handleExpenseSubmit}
            onCancel={() => setExpenseModal(null)}
          />
        </Modal>
      )}
    </div>
  );
}
