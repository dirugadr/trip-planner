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
import { budgetCategoryIcon } from '../utils/budgetCategoryIcon.js';
import Spinner from '../components/Spinner.jsx';
import ErrorMessage from '../components/ErrorMessage.jsx';
import Modal from '../components/Modal.jsx';
import BudgetCategoryForm from '../components/BudgetCategoryForm.jsx';
import ExpenseForm from '../components/ExpenseForm.jsx';

export default function BudgetPage() {
  const { id } = useParams();

  const { data, loading, error, reload } = useAsync(
    () =>
      Promise.all([getBudgetSummary(id), listExpenses(id), listPaymentMethods(), getTrip(id)]).then(
        ([budget, expenses, paymentMethods, trip]) => ({ budget, expenses, paymentMethods, trip })
      ),
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
    const ok = await confirm({ title: 'Eliminar categoría', message: `¿Eliminar la categoría "${category.name}"?` });
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
    <div className="max-w-3xl mx-auto px-6 py-6">
      <div className="row-between mb-4">
        <h1 className="text-[22px] font-bold">Presupuesto</h1>
        <button
          className="btn"
          onClick={() => setExpenseModal({})}
          disabled={budget.categories.length === 0}
          title={budget.categories.length === 0 ? 'Creá una categoría primero' : undefined}
        >
          <span className="msi text-[16px]">add</span>Nuevo gasto
        </button>
      </div>

      {actionError && <ErrorMessage error={actionError} />}
      <div className="muted mb-3">{trip.name}</div>

      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="bg-surface rounded-xl p-4 border border-outline-variant/20">
          <div className="text-[12px] text-on-surface-variant">Presupuesto</div>
          <div className="text-[20px] font-bold mt-1">
            {budget.total_budget != null ? formatMoney(budget.total_budget, currency) : '—'}
          </div>
        </div>
        <div className="bg-surface rounded-xl p-4 border border-outline-variant/20">
          <div className="text-[12px] text-on-surface-variant">Gastado</div>
          <div className="text-[20px] font-bold mt-1">{formatMoney(budget.total_spent, currency)}</div>
        </div>
        <div className="bg-surface rounded-xl p-4 border border-tertiary/30">
          <div className="text-[12px] text-tertiary font-medium">Pendiente</div>
          <div className="text-[20px] font-bold mt-1 text-tertiary">{formatMoney(budget.total_pending, currency)}</div>
        </div>
      </div>

      {pct != null && (
        <div className="mb-6">
          <div className="h-2.5 rounded-full bg-surface-container-low overflow-hidden">
            <div
              className={`h-full ${budget.over_budget ? 'bg-error' : 'bg-primary'}`}
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="flex justify-between text-[11px] text-on-surface-variant mt-1">
            <span>{pct}% del presupuesto usado</span>
            <span className={budget.over_budget ? 'text-error font-medium' : undefined}>
              {budget.remaining != null ? `${formatMoney(Math.abs(budget.remaining), currency)} ${budget.over_budget ? 'excedido' : 'disponible'}` : '—'}
            </span>
          </div>
        </div>
      )}

      <div className="row-between mb-2">
        <div className="text-[13px] font-semibold text-on-surface-variant">Por categoría</div>
        <button className="btn-link" onClick={() => setCategoryModal({})}>
          + Categoría
        </button>
      </div>

      {budget.categories.length === 0 ? (
        <div className="empty-state mb-6">Creá una categoría para empezar a repartir el presupuesto.</div>
      ) : (
        <div className="space-y-2 mb-6">
          {budget.categories.map((c) => (
            <div key={c.id} className="flex items-center gap-3">
              <span className="msi text-[16px] text-tertiary">{budgetCategoryIcon(c.name)}</span>
              <span className="text-[13px] flex-1 min-w-0 truncate">{c.name}</span>
              <span className="text-[13px] font-semibold shrink-0">
                {formatMoney(c.spent, currency)}
                {c.allocated_budget != null && ` / ${formatMoney(c.allocated_budget, currency)}`}
              </span>
              <div className="flex gap-1 shrink-0">
                <button
                  className="btn-icon msi text-[16px] text-on-surface-variant"
                  onClick={() => setCategoryModal({ category: c })}
                  aria-label="Editar categoría"
                >
                  edit
                </button>
                <button
                  className="btn-icon msi text-[16px] text-error"
                  onClick={() => handleDeleteCategory(c)}
                  aria-label="Eliminar categoría"
                >
                  delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="text-[13px] font-semibold text-on-surface-variant mb-2">Gastos recientes</div>

      {expenses.length === 0 ? (
        <div className="empty-state">Sin gastos registrados.</div>
      ) : (
        <div className="space-y-2">
          {expenses.map((e) => {
            const catName = catById.get(e.category_id)?.name;
            return (
              <div key={e.id} className="flex items-center gap-3 bg-surface rounded-xl p-3 border border-outline-variant/20">
                <span className="msi text-[18px] text-tertiary">{budgetCategoryIcon(catName)}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-medium truncate">{e.description || catName || 'Gasto'}</div>
                  <div className="text-[11px] text-on-surface-variant">
                    {formatDate(e.expense_date)}
                    {e.payment_method_id && pmById.get(e.payment_method_id) && ` · ${pmById.get(e.payment_method_id).name}`}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-[13px] font-semibold">{formatMoney(e.amount, e.currency_code)}</div>
                  <div className={`text-[10px] font-medium ${e.is_paid ? 'text-on-surface-variant' : 'text-tertiary'}`}>
                    {e.is_paid ? 'Pagado' : 'Pendiente'}
                  </div>
                </div>
                <div className="flex gap-1 shrink-0">
                  <button
                    className="btn-icon msi text-[16px] text-on-surface-variant"
                    onClick={() => setExpenseModal({ expense: e })}
                    aria-label="Editar gasto"
                  >
                    edit
                  </button>
                  <button
                    className="btn-icon msi text-[16px] text-error"
                    onClick={() => handleDeleteExpense(e)}
                    aria-label="Eliminar gasto"
                  >
                    delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {confirmNode}

      {categoryModal && (
        <Modal title={categoryModal.category ? 'Editar categoría' : 'Nueva categoría'} onClose={() => setCategoryModal(null)}>
          <BudgetCategoryForm initial={categoryModal.category} onSubmit={handleCategorySubmit} onCancel={() => setCategoryModal(null)} />
        </Modal>
      )}

      {expenseModal && (
        <Modal title={expenseModal.expense ? 'Editar gasto' : 'Nuevo gasto'} onClose={() => setExpenseModal(null)}>
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
