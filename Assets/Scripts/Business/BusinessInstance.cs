using System;

public class BusinessInstance
{
    public BusinessData Data { get; private set; }
    public int Level { get; private set; }
    public int StaffCount { get; private set; }
    public bool IsActive { get; private set; }
    public double AccumulatedRevenue { get; private set; }

    public event Action<BusinessInstance> OnChanged;

    public BusinessInstance(BusinessData data)
    {
        Data = data;
        Level = 1;
        StaffCount = 0;
        IsActive = true;
        AccumulatedRevenue = 0;
    }

    public BusinessInstance(BusinessData data, BusinessSaveEntry entry)
    {
        Data = data;
        Level = entry.level;
        StaffCount = entry.staffCount;
        IsActive = entry.isActive;
        AccumulatedRevenue = entry.accumulatedRevenue;
    }

    public double GetRevenuePerSecond() =>
        IsActive ? Data.GetRevenuePerSecond(Level, StaffCount) : 0;

    public bool CanUpgrade(double playerMoney) =>
        Level < Data.maxLevel && playerMoney >= Data.GetUpgradeCost(Level);

    public bool CanHireStaff(double playerMoney) =>
        StaffCount < Data.maxStaff && playerMoney >= Data.GetStaffHireCost(StaffCount);

    public void Upgrade()
    {
        Level++;
        OnChanged?.Invoke(this);
    }

    public void HireStaff()
    {
        StaffCount++;
        OnChanged?.Invoke(this);
    }

    public void SetActive(bool active)
    {
        IsActive = active;
        OnChanged?.Invoke(this);
    }

    public void AccumulateRevenue(double seconds)
    {
        AccumulatedRevenue += GetRevenuePerSecond() * seconds;
    }

    public double CollectRevenue()
    {
        double collected = AccumulatedRevenue;
        AccumulatedRevenue = 0;
        OnChanged?.Invoke(this);
        return collected;
    }
}
