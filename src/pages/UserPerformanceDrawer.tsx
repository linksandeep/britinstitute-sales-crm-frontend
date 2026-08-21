import React, { useEffect, useState } from "react";
import { X } from "lucide-react";
import toast from "react-hot-toast";
import api from "../lib/api";

interface Props {
  userId: string;
  onClose: () => void;
}

const UserPerformanceDrawer: React.FC<Props> = ({ userId, onClose }) => {
  const [performance, setPerformance] = useState<any>(null);
  const [analytics, setAnalytics] = useState<any>(null);

  const fetchData = async () => {
    try {
      const today = new Date();
      const from = "2025-01-01";
      const to = today.toISOString().split("T")[0];

      const month = today.getMonth() + 1;
      const year = today.getFullYear();

      const [perfRes, analyticsRes] = await Promise.all([
        api.get(`/performance/${userId}?from=${from}&to=${to}`),
        api.get(`/attendance/analytics/${userId}?month=${month}&year=${year}`),
      ]);

      if (perfRes.data.success) setPerformance(perfRes.data.data);
      if (analyticsRes.data.success) setAnalytics(analyticsRes.data);
    } catch (err) {
      toast.error("Failed to load user performance");
    }
  };

  useEffect(() => {
    fetchData();
  }, [userId]);

  return (
    <div className="fixed inset-0 bg-black/40 flex justify-end">
      <div className="w-[500px] bg-white p-6 overflow-y-auto">
        <button onClick={onClose} className="float-right">
          <X />
        </button>

        {performance && (
          <>
            <h2 className="text-xl font-bold mb-4">
              {performance.userDetails.name}
            </h2>

            <div className="grid grid-cols-2 gap-4 mb-6">
              <Card label="Total Assigned" value={performance.leadPerformance.totalAssigned} />
              <Card label="Total Closed" value={performance.leadPerformance.totalClosed} />
              <Card label="Conversion" value={performance.leadPerformance.conversionRate} />
              <Card label="Working Hours" value={performance.attendanceReport.totalWorkingHours} />
            </div>

            {analytics && (
              <>
                <h3 className="font-semibold mb-2">Monthly Attendance</h3>
                <div className="grid grid-cols-2 gap-4">
                  <Card label="Total Hours" value={analytics.stats.totalWorkingHours} />
                  <Card label="Auto Logout Hours" value={analytics.stats.autoLogoutHours} />
                  <Card label="Days Present" value={analytics.stats.totalDaysPresent} />
                  <Card label="Days Absent" value={analytics.stats.totalDaysNotPresent} />
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
};

const Card = ({ label, value }: any) => (
  <div className="bg-gray-100 p-4 rounded-lg text-center">
    <p className="text-xs text-gray-500">{label}</p>
    <p className="text-lg font-bold">{value}</p>
  </div>
);

export default UserPerformanceDrawer;
