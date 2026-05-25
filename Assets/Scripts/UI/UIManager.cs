using UnityEngine;

public class UIManager : MonoBehaviour
{
    public static UIManager Instance { get; private set; }

    [Header("Panels")]
    [SerializeField] private GameObject hudPanel;
    [SerializeField] private GameObject businessListPanel;
    [SerializeField] private GameObject skillPanel;
    [SerializeField] private GameObject marketplacePanel;
    [SerializeField] private GameObject businessDetailPanel;

    void Awake()
    {
        if (Instance != null && Instance != this) { Destroy(gameObject); return; }
        Instance = this;
    }

    void Start()
    {
        ShowHUD();
    }

    public void ShowHUD()
    {
        SetPanelActive(hudPanel, true);
        SetPanelActive(businessListPanel, false);
        SetPanelActive(skillPanel, false);
        SetPanelActive(marketplacePanel, false);
        SetPanelActive(businessDetailPanel, false);
    }

    public void ShowBusinessList()
    {
        SetPanelActive(businessListPanel, true);
        SetPanelActive(marketplacePanel, false);
        SetPanelActive(skillPanel, false);
        SetPanelActive(businessDetailPanel, false);
    }

    public void ShowSkillPanel()
    {
        SetPanelActive(skillPanel, true);
        SetPanelActive(businessListPanel, false);
        SetPanelActive(marketplacePanel, false);
        SetPanelActive(businessDetailPanel, false);
    }

    public void ShowMarketplace()
    {
        SetPanelActive(marketplacePanel, true);
        SetPanelActive(businessListPanel, false);
        SetPanelActive(skillPanel, false);
        SetPanelActive(businessDetailPanel, false);
    }

    public void ShowBusinessDetail(BusinessInstance instance)
    {
        SetPanelActive(businessDetailPanel, true);
        businessDetailPanel.GetComponent<BusinessDetailPanel>()?.Populate(instance);
    }

    private void SetPanelActive(GameObject panel, bool active)
    {
        if (panel != null) panel.SetActive(active);
    }
}
