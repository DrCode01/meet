using UnityEngine;
using System;
using System.Collections.Generic;
using System.Linq;

public class BusinessManager : MonoBehaviour
{
    [SerializeField] private BusinessData[] allBusinessDefinitions;

    public IReadOnlyList<BusinessInstance> ActiveBusinesses => _activeBusinesses;
    private List<BusinessInstance> _activeBusinesses = new();

    public event Action<BusinessInstance> OnBusinessPurchased;
    public event Action<BusinessInstance> OnBusinessUpgraded;
    public event Action<double> OnRevenueCollected;

    private PlayerData _player;
    private SkillSystem _skillSystem;
    private float _tickTimer;
    private const float TickInterval = 1f;

    void Awake()
    {
        _player = GetComponent<PlayerData>();
        _skillSystem = GetComponent<SkillSystem>();
    }

    public void Initialize()
    {
        _activeBusinesses.Clear();
    }

    public void LoadFrom(SaveData data, double offlineSeconds)
    {
        _activeBusinesses.Clear();

        foreach (var entry in data.businesses)
        {
            var def = Array.Find(allBusinessDefinitions, d => d.businessId == entry.businessId);
            if (def == null) continue;

            var instance = new BusinessInstance(def, entry);
            // Apply offline revenue
            instance.AccumulateRevenue(offlineSeconds);
            _activeBusinesses.Add(instance);
        }
    }

    void Update()
    {
        _tickTimer += Time.deltaTime;
        if (_tickTimer >= TickInterval)
        {
            _tickTimer -= TickInterval;
            Tick(TickInterval);
        }
    }

    private void Tick(float deltaSeconds)
    {
        foreach (var biz in _activeBusinesses)
            biz.AccumulateRevenue(deltaSeconds);
    }

    public double GetTotalRevenuePerSecond()
    {
        return _activeBusinesses.Sum(b => b.GetRevenuePerSecond());
    }

    public bool TryPurchaseBusiness(BusinessData data)
    {
        if (_activeBusinesses.Any(b => b.Data.businessId == data.businessId))
            return false;
        if (!_skillSystem.MeetsRequirements(data.skillRequirements))
            return false;
        if (_player.Money < data.minMoneyRequired)
            return false;
        if (_player.Reputation < data.minReputation)
            return false;
        if (!_player.SpendMoney(data.startupCost))
            return false;

        var instance = new BusinessInstance(data);
        _activeBusinesses.Add(instance);
        _player.AddReputation(data.reputationGainPerLevel);
        _skillSystem.AwardSkillPoint(data.skillPointsOnFirstPurchase);
        OnBusinessPurchased?.Invoke(instance);
        return true;
    }

    public bool TryUpgradeBusiness(BusinessInstance instance)
    {
        if (!instance.CanUpgrade(_player.Money)) return false;

        double cost = instance.Data.GetUpgradeCost(instance.Level);
        if (!_player.SpendMoney(cost)) return false;

        instance.Upgrade();
        _player.AddReputation(instance.Data.reputationGainPerLevel);

        if (instance.Level == instance.Data.maxLevel)
            _skillSystem.AwardSkillPoint(instance.Data.skillPointsOnMaxLevel);

        OnBusinessUpgraded?.Invoke(instance);
        return true;
    }

    public bool TryHireStaff(BusinessInstance instance)
    {
        if (!instance.CanHireStaff(_player.Money)) return false;

        double cost = instance.Data.GetStaffHireCost(instance.StaffCount);
        if (!_player.SpendMoney(cost)) return false;

        instance.HireStaff();
        return true;
    }

    public void CollectAllRevenue()
    {
        double total = 0;
        foreach (var biz in _activeBusinesses)
            total += biz.CollectRevenue();

        if (total > 0)
        {
            _player.EarnMoney(total);
            OnRevenueCollected?.Invoke(total);
        }
    }

    public IEnumerable<BusinessData> GetUnlockedBusinesses()
    {
        return allBusinessDefinitions.Where(d =>
            _skillSystem.MeetsRequirements(d.skillRequirements) &&
            _player.Reputation >= d.minReputation &&
            !_activeBusinesses.Any(b => b.Data.businessId == d.businessId));
    }

    public IEnumerable<BusinessData> GetLockedBusinesses()
    {
        return allBusinessDefinitions.Where(d =>
            !_skillSystem.MeetsRequirements(d.skillRequirements) ||
            _player.Reputation < d.minReputation);
    }
}
