using UnityEngine;
using System;

public class PlayerData : MonoBehaviour
{
    public string PlayerName { get; private set; }
    public double Money { get; private set; }
    public double TotalEarned { get; private set; }
    public int Reputation { get; private set; }

    public event Action<double> OnMoneyChanged;
    public event Action<int> OnReputationChanged;

    public void Initialize(string name)
    {
        PlayerName = name;
        Money = 1000.0;
        TotalEarned = 0.0;
        Reputation = 0;
    }

    public void LoadFrom(SaveData data)
    {
        PlayerName = data.playerName;
        Money = data.money;
        TotalEarned = data.totalEarned;
        Reputation = data.reputation;
    }

    public bool SpendMoney(double amount)
    {
        if (Money < amount) return false;
        Money -= amount;
        OnMoneyChanged?.Invoke(Money);
        return true;
    }

    public void EarnMoney(double amount)
    {
        Money += amount;
        TotalEarned += amount;
        OnMoneyChanged?.Invoke(Money);
    }

    public void AddReputation(int amount)
    {
        Reputation = Mathf.Clamp(Reputation + amount, 0, 1000);
        OnReputationChanged?.Invoke(Reputation);
    }

    public string GetFormattedMoney() => FormatLargeNumber(Money);
    public string GetFormattedTotalEarned() => FormatLargeNumber(TotalEarned);

    public static string FormatLargeNumber(double value)
    {
        if (value >= 1_000_000_000_000) return $"${value / 1_000_000_000_000:F1}T";
        if (value >= 1_000_000_000) return $"${value / 1_000_000_000:F1}B";
        if (value >= 1_000_000) return $"${value / 1_000_000:F1}M";
        if (value >= 1_000) return $"${value / 1_000:F1}K";
        return $"${value:F0}";
    }
}
