import { useEffect, useState } from "react";
import { LoanRecord, listLoans } from "../api";
import { navigate } from "../router";

export default function Loans() {
  const [loans, setLoans] = useState<LoanRecord[]>([]);

  useEffect(() => {
    listLoans().then(setLoans);
  }, []);

  return (
    <div className="loans-page">
      <h2>Loaned out</h2>
      {loans.length === 0 ? (
        <p>Nothing is currently loaned out.</p>
      ) : (
        <ul className="loans-list">
          {loans.map((loan) => (
            <li key={loan.item_id}>
              <button onClick={() => loan.bin_code && navigate(`/b/${loan.bin_code}`)}>
                {loan.item_name} ({loan.bin_label ?? loan.bin_code})
              </button>
              <span>to {loan.loaned_to}</span>
              <span>since {new Date(loan.loaned_at).toLocaleDateString()}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
