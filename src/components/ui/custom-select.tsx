'use client';

import type { ComponentPropsWithRef } from 'react';
import { ChevronDown } from 'lucide-react';

/** Native selection keeps form validation, label association and keyboard support. */
export function CustomSelect({ children, className, ...props }: ComponentPropsWithRef<'select'>) {
  return <span className="custom-select">
    <select {...props} className={['custom-select-control', className].filter(Boolean).join(' ')}>
      {children}
    </select>
    {!props.multiple && !(props.size && props.size > 1) &&
      <ChevronDown className="custom-select-arrow" size={16} aria-hidden="true" />}
  </span>;
}
