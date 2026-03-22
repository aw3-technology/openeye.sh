import { ChevronLeft, ChevronRight, Receipt } from "lucide-react";
import type { useCreditTransactions } from "@/hooks/useCredits";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface TransactionHistoryProps {
  transactions: ReturnType<typeof useCreditTransactions>;
  txPage: number;
  setTxPage: React.Dispatch<React.SetStateAction<number>>;
  pageSize?: number;
}

export function TransactionHistory({
  transactions,
  txPage,
  setTxPage,
  pageSize = 20,
}: TransactionHistoryProps) {
  const totalTx = transactions.data?.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalTx / pageSize));

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-medium">Transaction History</h2>
        {totalTx > 0 && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Receipt className="h-3.5 w-3.5" />
            {totalTx.toLocaleString()} total
          </div>
        )}
      </div>
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="text-right">Amount</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {transactions.data?.data?.map((tx) => (
              <TableRow key={tx.id}>
                <TableCell className="text-xs tabular-nums">
                  {new Date(tx.created_at).toLocaleDateString()}
                </TableCell>
                <TableCell className="text-xs">
                  <Badge
                    variant={
                      tx.type === "purchase"
                        ? "default"
                        : tx.type === "refund"
                          ? "secondary"
                          : tx.type === "bonus"
                            ? "secondary"
                            : "outline"
                    }
                    className="text-[10px]"
                  >
                    {tx.type}
                  </Badge>
                </TableCell>
                <TableCell className="text-xs">{tx.description}</TableCell>
                <TableCell
                  className={`text-right text-xs tabular-nums font-medium ${
                    tx.amount > 0 ? "text-green-600" : "text-red-500"
                  }`}
                >
                  {tx.amount > 0 ? "+" : ""}
                  {tx.amount}
                </TableCell>
              </TableRow>
            ))}
            {transactions.isLoading && (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-sm text-muted-foreground">
                  Loading...
                </TableCell>
              </TableRow>
            )}
            {transactions.isError && (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-sm text-destructive">
                  Failed to load transactions.
                </TableCell>
              </TableRow>
            )}
            {!transactions.isLoading &&
              !transactions.isError &&
              (transactions.data?.data.length ?? 0) === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-sm text-muted-foreground">
                    No transactions yet.
                  </TableCell>
                </TableRow>
              )}
          </TableBody>
        </Table>
        {totalPages > 1 && (
          <div className="flex items-center justify-end gap-2 border-t px-4 py-2">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              disabled={txPage === 0}
              onClick={() => setTxPage((p) => p - 1)}
              aria-label="Previous page"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span
              className="text-xs text-muted-foreground"
              aria-label={`Page ${txPage + 1} of ${totalPages}`}
            >
              {txPage + 1} / {totalPages}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              disabled={txPage >= totalPages - 1}
              onClick={() => setTxPage((p) => p + 1)}
              aria-label="Next page"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}
