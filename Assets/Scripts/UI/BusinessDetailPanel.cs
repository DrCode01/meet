using UnityEngine;
using UnityEngine.UI;
using TMPro;

public class BusinessDetailPanel : MonoBehaviour
{
    [SerializeField] private TextMeshProUGUI nameText;
    [SerializeField] private TextMeshProUGUI descriptionText;
    [SerializeField] private TextMeshProUGUI levelText;
    [SerializeField] private TextMeshProUGUI revenueText;
    [SerializeField] private TextMeshProUGUI staffText;
    [SerializeField] private TextMeshProUGUI accumulatedText;
    [SerializeField] private Button upgradeButton;
    [SerializeField] private TextMeshProUGUI upgradeCostText;
    [SerializeField] private Button hireStaffButton;
    [SerializeField] private TextMeshProUGUI hireCostText;
    [SerializeField] private Button collectButton;
    [SerializeField] private Button closeButton;

    private BusinessInstance _instance;

    void Start()
    {
        closeButton?.onClick.AddListener(() => UIManager.Instance.ShowBusinessList());
        upgradeButton?.onClick.AddListener(OnUpgrade);
        hireStaffButton?.onClick.AddListener(OnHireStaff);
        collectButton?.onClick.AddListener(OnCollect);
    }

    public void Populate(BusinessInstance instance)
    {
        if (_instance != null) _instance.OnChanged -= OnInstanceChanged;
        _instance = instance;
        _instance.OnChanged += OnInstanceChanged;
        Refresh();
    }

    private void OnInstanceChanged(BusinessInstance _) => Refresh();

    private void Refresh()
    {
        if (_instance == null) return;
        var d = _instance.Data;

        if (nameText) nameText.text = d.businessName;
        if (descriptionText) descriptionText.text = d.description;
        if (levelText) levelText.text = $"Level {_instance.Level} / {d.maxLevel}";
        if (revenueText)
            revenueText.text = $"Revenue: {PlayerData.FormatLargeNumber(_instance.GetRevenuePerSecond())}/s";
        if (staffText) staffText.text = $"Staff: {_instance.StaffCount} / {d.maxStaff}";
        if (accumulatedText)
            accumulatedText.text = $"Ready: {PlayerData.FormatLargeNumber(_instance.AccumulatedRevenue)}";

        bool canUpgrade = _instance.Level < d.maxLevel;
        if (upgradeButton) upgradeButton.gameObject.SetActive(canUpgrade);
        if (upgradeCostText && canUpgrade)
            upgradeCostText.text = $"Upgrade: {PlayerData.FormatLargeNumber(d.GetUpgradeCost(_instance.Level))}";

        bool canHire = _instance.StaffCount < d.maxStaff;
        if (hireStaffButton) hireStaffButton.gameObject.SetActive(canHire);
        if (hireCostText && canHire)
            hireCostText.text = $"Hire: {PlayerData.FormatLargeNumber(d.GetStaffHireCost(_instance.StaffCount))}";
    }

    private void OnUpgrade() => GameManager.Instance.BusinessManager.TryUpgradeBusiness(_instance);
    private void OnHireStaff() => GameManager.Instance.BusinessManager.TryHireStaff(_instance);
    private void OnCollect()
    {
        double revenue = _instance.CollectRevenue();
        GameManager.Instance.Player.EarnMoney(revenue);
    }
}
