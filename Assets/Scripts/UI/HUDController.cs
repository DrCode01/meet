using UnityEngine;
using TMPro;
using UnityEngine.UI;

public class HUDController : MonoBehaviour
{
    [Header("Money Display")]
    [SerializeField] private TextMeshProUGUI moneyText;
    [SerializeField] private TextMeshProUGUI revenuePerSecText;
    [SerializeField] private TextMeshProUGUI reputationText;

    [Header("Collect Button")]
    [SerializeField] private Button collectButton;
    [SerializeField] private TextMeshProUGUI collectButtonText;

    [Header("Navigation Buttons")]
    [SerializeField] private Button businessesButton;
    [SerializeField] private Button skillsButton;
    [SerializeField] private Button marketplaceButton;

    private GameManager _gm;
    private float _refreshTimer;
    private const float RefreshInterval = 0.5f;

    void Start()
    {
        _gm = GameManager.Instance;

        _gm.Player.OnMoneyChanged += _ => RefreshMoneyDisplay();
        _gm.Player.OnReputationChanged += _ => RefreshMoneyDisplay();

        collectButton?.onClick.AddListener(OnCollect);
        businessesButton?.onClick.AddListener(() => UIManager.Instance.ShowBusinessList());
        skillsButton?.onClick.AddListener(() => UIManager.Instance.ShowSkillPanel());
        marketplaceButton?.onClick.AddListener(() => UIManager.Instance.ShowMarketplace());

        RefreshMoneyDisplay();
    }

    void Update()
    {
        _refreshTimer += Time.deltaTime;
        if (_refreshTimer >= RefreshInterval)
        {
            _refreshTimer = 0f;
            RefreshRevenueDisplay();
        }
    }

    private void OnCollect()
    {
        _gm.BusinessManager.CollectAllRevenue();
    }

    private void RefreshMoneyDisplay()
    {
        if (moneyText) moneyText.text = _gm.Player.GetFormattedMoney();
        if (reputationText) reputationText.text = $"Rep: {_gm.Player.Reputation}";
    }

    private void RefreshRevenueDisplay()
    {
        double rps = _gm.BusinessManager.GetTotalRevenuePerSecond();
        if (revenuePerSecText)
            revenuePerSecText.text = $"{PlayerData.FormatLargeNumber(rps)}/s";

        // Show accumulated amount on collect button
        double accumulated = 0;
        foreach (var biz in _gm.BusinessManager.ActiveBusinesses)
            accumulated += biz.AccumulatedRevenue;

        if (collectButtonText)
            collectButtonText.text = accumulated > 0
                ? $"Collect {PlayerData.FormatLargeNumber(accumulated)}"
                : "Collect";
    }
}
