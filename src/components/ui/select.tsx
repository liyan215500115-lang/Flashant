import { Select as SelectPrimitive } from "@base-ui/react/select"
import { cn } from "@/lib/utils"
import { ChevronDown } from "lucide-react"

function Select({
  children,
  ...props
}: SelectPrimitive.Root.Props<string>) {
  return (
    <SelectPrimitive.Root {...props}>
      {children}
    </SelectPrimitive.Root>
  )
}

function SelectTrigger({
  children,
  className,
  renderValue,
  ...props
}: SelectPrimitive.Trigger.Props & { renderValue?: (value: string) => string }) {
  return (
    <SelectPrimitive.Trigger
      className={cn(
        "flex h-9 w-full items-center justify-between gap-2 rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/20 data-[popup-open]:border-ring",
        className
      )}
      {...props}
    >
      <SelectPrimitive.Value placeholder="Select...">
        {renderValue
          ? ((value: string) => renderValue(value ?? "")) as never
          : undefined}
      </SelectPrimitive.Value>
      <ChevronDown size={14} className="text-muted-foreground shrink-0" />
    </SelectPrimitive.Trigger>
  )
}

function SelectPopover({
  children,
  className,
  ...props
}: SelectPrimitive.Popup.Props) {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Positioner>
        <SelectPrimitive.Popup
          className={cn(
            "z-50 min-w-[var(--anchor-width)] overflow-hidden rounded-lg border border-border bg-popover p-1 text-popover-foreground shadow-md origin-[var(--transform-origin)] transition-[transform,opacity] data-[closed]:scale-95 data-[closed]:opacity-0 data-[open]:scale-100 data-[open]:opacity-100",
            className
          )}
          {...props}
        >
          {children}
        </SelectPrimitive.Popup>
      </SelectPrimitive.Positioner>
    </SelectPrimitive.Portal>
  )
}

function SelectItem({
  children,
  className,
  ...props
}: SelectPrimitive.Item.Props) {
  return (
    <SelectPrimitive.Item
      className={cn(
        "relative flex cursor-pointer select-none items-center gap-2 rounded-md px-2 py-1.5 text-sm outline-none transition-colors hover:bg-muted focus:bg-muted data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
        className
      )}
      {...props}
    >
      <SelectPrimitive.ItemIndicator className="absolute left-2 flex items-center">
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M10 3L4.5 8.5L2 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
      </SelectPrimitive.ItemIndicator>
      <SelectPrimitive.ItemText className="pl-5">
        {children}
      </SelectPrimitive.ItemText>
    </SelectPrimitive.Item>
  )
}

export { Select, SelectTrigger, SelectPopover, SelectItem }
