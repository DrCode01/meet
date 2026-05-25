using UnityEngine;
using UnityEngine.UI;
using TMPro;

public class MainMenuController : MonoBehaviour
{
    [SerializeField] private Button newGameButton;
    [SerializeField] private Button continueButton;
    [SerializeField] private Button deleteSaveButton;
    [SerializeField] private TMP_InputField playerNameInput;
    [SerializeField] private GameObject nameEntryPanel;
    [SerializeField] private GameObject mainButtonsPanel;

    void Start()
    {
        bool hasSave = SaveSystem.HasSave();
        continueButton?.gameObject.SetActive(hasSave);
        deleteSaveButton?.gameObject.SetActive(hasSave);

        newGameButton?.onClick.AddListener(OnNewGame);
        continueButton?.onClick.AddListener(OnContinue);
        deleteSaveButton?.onClick.AddListener(OnDeleteSave);

        if (nameEntryPanel) nameEntryPanel.SetActive(false);
        if (mainButtonsPanel) mainButtonsPanel.SetActive(true);
    }

    private void OnNewGame()
    {
        if (nameEntryPanel) nameEntryPanel.SetActive(true);
        if (mainButtonsPanel) mainButtonsPanel.SetActive(false);
    }

    public void OnConfirmName()
    {
        string name = playerNameInput != null ? playerNameInput.text.Trim() : "Entrepreneur";
        if (string.IsNullOrEmpty(name)) name = "Entrepreneur";
        GameManager.Instance.NewGame(name);
    }

    public void OnCancelName()
    {
        if (nameEntryPanel) nameEntryPanel.SetActive(false);
        if (mainButtonsPanel) mainButtonsPanel.SetActive(true);
    }

    private void OnContinue()
    {
        UnityEngine.SceneManagement.SceneManager.LoadScene("GameScene");
    }

    private void OnDeleteSave()
    {
        SaveSystem.DeleteSave();
        continueButton?.gameObject.SetActive(false);
        deleteSaveButton?.gameObject.SetActive(false);
    }
}
