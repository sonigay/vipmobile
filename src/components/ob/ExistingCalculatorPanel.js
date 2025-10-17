import React from 'react';

export default function ExistingCalculatorPanel({ inputs, result, onSave }) {
  return (
    <div className="panel existing">
      <div className="panel-head">
        <div>기존결합 계산식</div>
        <button onClick={onSave}>저장</button>
      </div>
      <div className="summary">
        <div>총액: {Number(result?.amount || 0).toLocaleString()}</div>
        <div>회선수: {inputs?.lines?.length || 0}</div>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>line#</th>
              <th>plan</th>
              <th>group</th>
              <th>base</th>
              <th>total</th>
            </tr>
          </thead>
          <tbody>
            {(result?.rows || []).map(row => (
              <tr key={row.lineNo}>
                <td>{row.lineNo}</td>
                <td>{row.planName}</td>
                <td>{row.planGroup}</td>
                <td>{Number(row.baseFee || 0).toLocaleString()}</td>
                <td>{Number(row.total || 0).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}


