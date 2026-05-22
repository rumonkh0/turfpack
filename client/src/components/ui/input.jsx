import * as React from "react"

import { cn } from "@/lib/utils"

const Input = React.forwardRef(({ className, type, onChange, onFocus, ...props }, ref) => {
  const handleFocus = (e) => {
    if (type === "number") {
      e.target.select();
    }
    if (onFocus) {
      onFocus(e);
    }
  };

  const handleChange = (e) => {
    if (type === "number") {
      let val = e.target.value;
      if (val) {
        const isNegative = val.startsWith("-");
        if (isNegative) {
          val = val.slice(1);
        }
        if (val.length > 1 && val.startsWith("0") && !val.startsWith("0.")) {
          val = val.replace(/^0+/, "");
          if (val === "") val = "0";
        }
        e.target.value = isNegative ? "-" + val : val;
      }
    }
    if (onChange) {
      onChange(e);
    }
  };

  return (
    <input
      type={type}
      onChange={handleChange}
      onFocus={handleFocus}
      className={cn(
        "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        className
      )}
      ref={ref}
      {...props} />
  );
})
Input.displayName = "Input"

export { Input }
