'use client';
import {
  Children,
  cloneElement,
  isValidElement,
  useContext,
  useId,
  type ReactNode,
  type ReactElement,
} from 'react';
import { FormErrors } from './form-state';
type ControlProps = {
  id?: string;
  name?: string;
  children?: ReactNode;
  'aria-invalid'?: boolean;
  'aria-describedby'?: string;
};
export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  const uid = useId();
  const controlId = `field-${uid}`;
  const hintId = `hint-${uid}`;
  const errorId = `error-${uid}`;
  const errors = useContext(FormErrors);
  function names(nodes: ReactNode): string[] {
    return Children.toArray(nodes).flatMap((node) => {
      if (!isValidElement<ControlProps>(node)) return [];
      if (typeof node.type === 'string' && ['input', 'select', 'textarea'].includes(node.type))
        return [node.props.name || ''];
      return names(node.props.children);
    });
  }
  const error = errors[names(children)[0] || ''];
  function connect(nodes: ReactNode): ReactNode {
    return Children.map(nodes, (node) => {
      if (!isValidElement<ControlProps>(node)) return node;
      if (typeof node.type === 'string' && ['input', 'select', 'textarea'].includes(node.type)) {
        return cloneElement(node, {
          id: controlId,
          'aria-invalid': !!error,
          'aria-describedby':
            [hint ? hintId : '', error ? errorId : ''].filter(Boolean).join(' ') || undefined,
        });
      }
      return node.props.children
        ? cloneElement(node as ReactElement<ControlProps>, {}, connect(node.props.children))
        : node;
    });
  }
  const controls = connect(children);
  return (
    <div className="field">
      <label htmlFor={controlId}>{label}</label>
      {controls}
      {hint && <small id={hintId}>{hint}</small>}
      {error && (
        <small id={errorId} className="error-text" role="alert">
          {error}
        </small>
      )}
    </div>
  );
}
