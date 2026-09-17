import { useState, useEffect } from "react";
import { FiBox, FiRotateCcw } from "react-icons/fi";
import { getEmployeeAssets } from "../../services/assetService";
import Loader from "../Loader/Loader";
import "../../pages/Assets/Assets.css";

export default function EmployeeAssetsTab({ employeeId }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let ignore = false;
    if (!employeeId) return;

    getEmployeeAssets(employeeId)
      .then((res) => {
        if (!ignore) {
          setData(res);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!ignore) {
          setError(err.message || "Failed to load employee assets");
          setLoading(false);
        }
      });

    return () => {
      ignore = true;
    };
  }, [employeeId]);

  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: "center" }}>
        <Loader text="Loading assigned assets..." />
      </div>
    );
  }

  if (error) {
    return <div className="emp-alert error">{error}</div>;
  }

  const activeAssets = data?.activeAssets || [];
  const returnedAssets = data?.returnedAssets || [];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24, width: "100%" }}>
      {/* Currently Held Assets */}
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
          <FiBox size={18} style={{ color: "#4f46e5" }} />
          <h3 style={{ fontSize: 16, fontWeight: 700, color: "#1e293b", margin: 0 }}>
            Currently Assigned Hardware & Assets ({activeAssets.length})
          </h3>
        </div>

        {activeAssets.length === 0 ? (
          <div
            style={{
              padding: 24,
              border: "1px dashed #cbd5e1",
              borderRadius: 12,
              textAlign: "center",
              color: "#64748b",
              background: "#f8fafc",
            }}
          >
            No company assets are currently assigned to this employee.
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 }}>
            {activeAssets.map((item) => {
              const asset = item.asset_id;
              if (!asset) return null;
              return (
                <div
                  key={item._id}
                  style={{
                    border: "1px solid #e2e8f0",
                    borderRadius: 12,
                    padding: 16,
                    background: "#ffffff",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div>
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          background: "#e0e7ff",
                          color: "#4338ca",
                          padding: "2px 8px",
                          borderRadius: 6,
                          textTransform: "uppercase",
                        }}
                      >
                        {asset.type}
                      </span>
                      <h4 style={{ fontSize: 15, fontWeight: 700, color: "#1e293b", margin: "6px 0 2px 0" }}>
                        {asset.brand} {asset.model}
                      </h4>
                      <div style={{ fontSize: 12, color: "#64748b" }}>
                        Tag: <strong>{asset.asset_tag}</strong>
                        {asset.serial_number && ` • S/N: ${asset.serial_number}`}
                      </div>
                    </div>
                    <span className="asset-status-pill asset-status-assigned">Active</span>
                  </div>

                  <div
                    style={{
                      marginTop: 12,
                      padding: "8px 12px",
                      background: "#f8fafc",
                      borderRadius: 8,
                      fontSize: 12,
                      color: "#475569",
                      display: "flex",
                      flexDirection: "column",
                      gap: 4,
                    }}
                  >
                    <div>
                      <strong>Assigned On:</strong>{" "}
                      {new Date(item.assigned_date).toLocaleDateString("en-IN")}
                    </div>
                    {item.assigned_by?.name && (
                      <div>
                        <strong>Assigned By:</strong> {item.assigned_by.name}
                      </div>
                    )}
                    {item.notes && (
                      <div>
                        <strong>Notes:</strong> {item.notes}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Return History */}
      {returnedAssets.length > 0 && (
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
            <FiRotateCcw size={18} style={{ color: "#64748b" }} />
            <h3 style={{ fontSize: 16, fontWeight: 700, color: "#1e293b", margin: 0 }}>
              Past Returned Assets ({returnedAssets.length})
            </h3>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {returnedAssets.map((item) => {
              const asset = item.asset_id;
              return (
                <div
                  key={item._id}
                  style={{
                    border: "1px solid #e2e8f0",
                    borderRadius: 10,
                    padding: "12px 16px",
                    background: "#f8fafc",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    flexWrap: "wrap",
                    gap: 12,
                  }}
                >
                  <div>
                    <strong>
                      {asset?.brand} {asset?.model} ({asset?.asset_tag || "AST"})
                    </strong>
                    <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
                      Assigned: {new Date(item.assigned_date).toLocaleDateString("en-IN")} &bull;{" "}
                      Returned: {new Date(item.returned_date).toLocaleDateString("en-IN")}
                    </div>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    {item.return_condition && (
                      <span className="condition-pill condition-good">
                        Condition: {item.return_condition}
                      </span>
                    )}
                    <span className="asset-status-pill asset-status-available">Returned</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
