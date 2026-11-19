import {
  fieldLabel,
  isNullable,
  optionLabel,
  parseFieldValue,
  toInputText,
  type FieldDefinition,
  type FieldValues,
} from '@ger/shared';
import { useState, type FormEvent } from 'react';
import { Button } from './Button.tsx';
import styles from './RecordForm.module.css';
import { Segmented } from './Segmented.tsx';
import { SelectField } from './SelectField.tsx';
import { TextField } from './TextField.tsx';

/**
 * Formulario de un registro, armado desde la definición de sus campos
 * (la misma que usa el bot). Sirve para crear y para editar en cualquier área.
 */

interface RecordFormProps {
  fields: readonly FieldDefinition[];
  /** Valores iniciales, con la forma de la API (montos en centavos, fechas ISO). */
  initial: object;
  mode: 'create' | 'update';
  /** Sugerencias para autocompletar campos de texto: `{ categoria: [...] }`. */
  suggestions?: Readonly<Record<string, readonly string[]>>;
  submitLabel: string;
  /** Si falla con errores por campo (`{ fields }`), se muestran en cada campo. */
  onSubmit(values: FieldValues): Promise<void>;
  onCancel(): void;
}

const SEGMENTED_MAX_OPTIONS = 4;

export function RecordForm({ fields, initial, mode, suggestions = {}, submitLabel, onSubmit, onCancel }: RecordFormProps) {
  const [text, setText] = useState<Record<string, string>>(() =>
    Object.fromEntries(fields.map((field) => [field.key, toInputText(field, (initial as Record<string, unknown>)[field.key])])),
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const set = (key: string, value: string) => {
    setText((current) => ({ ...current, [key]: value }));
    setErrors(({ [key]: _, ...rest }) => rest);
  };

  async function submit(event: FormEvent) {
    event.preventDefault();
    const values: FieldValues = {};
    const found: Record<string, string> = {};
    for (const field of fields) {
      const result = parseFieldValue(field, text[field.key] ?? '');
      if (!result.ok) found[field.key] = result.error;
      // Al editar, vaciar un campo con valor por defecto no tiene sentido: no se puede.
      else if (mode === 'update' && result.value === null && !isNullable(field)) found[field.key] = 'falta';
      else values[field.key] = result.value;
    }
    setErrors(found);
    setFormError(null);
    if (Object.keys(found).length > 0) return;

    setBusy(true);
    try {
      await onSubmit(values);
    } catch (error) {
      const fieldErrors = (error as { fields?: Record<string, string> }).fields ?? {};
      setErrors(fieldErrors);
      if (Object.keys(fieldErrors).length === 0) setFormError(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className={styles.form} onSubmit={(event) => void submit(event)} noValidate>
      {fields.map((field) => (
        <FieldInput
          key={field.key}
          field={field}
          value={text[field.key] ?? ''}
          error={errors[field.key]}
          suggestions={suggestions[field.key]}
          onChange={(value) => set(field.key, value)}
        />
      ))}
      {formError && (
        <p className={styles.formError} role="alert">
          {formError}
        </p>
      )}
      <div className={styles.buttons}>
        <Button onClick={onCancel}>Cancelar</Button>
        <Button type="submit" variant="primary" disabled={busy}>
          {busy ? 'Guardando…' : submitLabel}
        </Button>
      </div>
    </form>
  );
}

interface FieldInputProps {
  field: FieldDefinition;
  value: string;
  error: string | undefined;
  suggestions: readonly string[] | undefined;
  onChange(value: string): void;
}

function FieldInput({ field, value, error, suggestions, onChange }: FieldInputProps) {
  const label = fieldLabel(field) + (isNullable(field) ? ' (opcional)' : '');
  const common = { label, value, onChange, error, hint: field.hint };

  switch (field.type) {
    case 'enum': {
      const options = field.options.map((option) => ({ value: option, label: optionLabel(field, option) }));
      if (options.length > SEGMENTED_MAX_OPTIONS) {
        return <SelectField {...common} options={isNullable(field) ? [{ value: '', label: '—' }, ...options] : options} />;
      }
      return (
        <div className={styles.group}>
          <span className={styles.groupLabel}>{label}</span>
          <Segmented label={fieldLabel(field)} value={value} options={options} onChange={onChange} />
          {error && <p className={styles.formError}>{error}</p>}
        </div>
      );
    }
    case 'money':
      return (
        <TextField
          {...common}
          inputMode="decimal"
          autoComplete="off"
          placeholder="0"
          onBlur={() => {
            // Al salir del campo, se ve el monto como se va a guardar: 1500 → 1.500.
            const parsed = parseFieldValue(field, value);
            if (parsed.ok && parsed.value !== null) onChange(toInputText(field, parsed.value));
          }}
        />
      );
    case 'date':
      return <TextField {...common} type="date" />;
    case 'time':
      return <TextField {...common} type="time" />;
    case 'number':
    case 'int':
      return <TextField {...common} inputMode={field.type === 'int' ? 'numeric' : 'decimal'} autoComplete="off" />;
    case 'text':
      return <TextField {...common} suggestions={suggestions} autoComplete="off" />;
  }
}
